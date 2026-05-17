import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3e3;
const ASAAS_API_KEY = (process.env.ASAAS_API_KEY ?? "").replace(/^\\+/, "").trim();
const ASAAS_BASE_URL = process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
const WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET ?? "";
app.use(express.json());
app.set("trust proxy", true);
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
app.get("/api/client-ip", (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.headers["x-real-ip"] ?? req.socket.remoteAddress ?? "0.0.0.0";
  res.json({ ip });
});
app.post("/api/payments/create-pix", requireAuth, async (req, res) => {
  try {
    const { customer, value, dueDate, description, externalReference, installment_id } = req.body;
    if (!ASAAS_API_KEY) {
      res.status(503).json({ error: "Integra\xE7\xE3o Asaas n\xE3o configurada. Defina ASAAS_API_KEY no servidor." });
      return;
    }
    if (!customer || !value || !dueDate) {
      res.status(400).json({ error: "customer, value and dueDate are required" });
      return;
    }
    let confirmedValue = Number(value);
    if (installment_id) {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: inst, error } = await sb.from("installments").select("value").eq("id", installment_id).single();
      if (error || !inst) {
        res.status(400).json({ error: "Parcela n\xE3o encontrada" });
        return;
      }
      if (Math.abs(Number(inst.value) - Number(value)) > 0.01) {
        res.status(400).json({ error: "Valor inv\xE1lido" });
        return;
      }
      confirmedValue = Number(inst.value);
    }
    const customerRes = await asaasRequest("POST", "/customers", {
      name: customer.name,
      cpfCnpj: customer.cpf?.replace(/\D/g, ""),
      email: customer.email,
      mobilePhone: customer.phone?.replace(/\D/g, "")
    });
    const paymentRes = await asaasRequest("POST", "/payments", {
      customer: customerRes.id,
      billingType: "PIX",
      value: confirmedValue,
      dueDate,
      description,
      externalReference,
      fine: { value: 2, type: "PERCENTAGE" },
      interest: { value: 1, type: "MONTHLY" }
    });
    const pixRes = await asaasRequest("GET", `/payments/${paymentRes.id}/pixQrCode`);
    if (installment_id) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      await supabase.from("installments").update({ asaas_payment_id: paymentRes.id }).eq("id", installment_id);
    }
    res.json({
      payment_id: paymentRes.id,
      status: paymentRes.status,
      pix_key: pixRes.payload,
      pix_qr_code: pixRes.encodedImage,
      due_date: paymentRes.dueDate,
      value: paymentRes.value
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});
app.post("/api/payments/create-boleto", requireAuth, async (req, res) => {
  try {
    const { customer, value, dueDate, description, externalReference } = req.body;
    const customerRes = await asaasRequest("POST", "/customers", {
      name: customer.name,
      cpfCnpj: customer.cpf?.replace(/\D/g, ""),
      email: customer.email
    });
    const paymentRes = await asaasRequest("POST", "/payments", {
      customer: customerRes.id,
      billingType: "BOLETO",
      value,
      dueDate,
      description,
      externalReference
    });
    res.json({
      payment_id: paymentRes.id,
      status: paymentRes.status,
      bank_slip_url: paymentRes.bankSlipUrl,
      bar_code: paymentRes.nossoNumero,
      due_date: paymentRes.dueDate,
      value: paymentRes.value
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});
app.post("/api/payments/create-installments", requireAuth, async (req, res) => {
  try {
    const { customer, value, dueDate, description, externalReference, installment_id } = req.body;
    if (!ASAAS_API_KEY) {
      res.status(503).json({ error: "Integra\xE7\xE3o Asaas n\xE3o configurada. Defina ASAAS_API_KEY no servidor." });
      return;
    }
    if (!customer || !value || !dueDate) {
      res.status(400).json({ error: "customer, value and dueDate are required" });
      return;
    }
    let confirmedValue = Number(value);
    if (installment_id) {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: inst, error } = await sb.from("installments").select("value").eq("id", installment_id).single();
      if (error || !inst) {
        res.status(400).json({ error: "Parcela n\xE3o encontrada" });
        return;
      }
      if (Math.abs(Number(inst.value) - Number(value)) > 0.01) {
        res.status(400).json({ error: "Valor inv\xE1lido" });
        return;
      }
      confirmedValue = Number(inst.value);
    }
    const customerRes = await asaasRequest("POST", "/customers", {
      name: customer.name,
      cpfCnpj: customer.cpf?.replace(/\D/g, ""),
      email: customer.email,
      mobilePhone: customer.phone?.replace(/\D/g, "")
    });
    const basePayload = {
      customer: customerRes.id,
      value: confirmedValue,
      dueDate,
      description,
      externalReference,
      fine: { value: 2, type: "PERCENTAGE" },
      interest: { value: 1, type: "MONTHLY" }
    };
    const [pixPayment, boletoPayment] = await Promise.all([
      asaasRequest("POST", "/payments", { ...basePayload, billingType: "PIX" }),
      asaasRequest("POST", "/payments", { ...basePayload, billingType: "BOLETO" })
    ]);
    const pixQr = await asaasRequest("GET", `/payments/${pixPayment.id}/pixQrCode`);
    if (installment_id) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      await supabase.from("installments").update({ asaas_payment_id: pixPayment.id }).eq("id", installment_id);
    }
    res.json({
      pix: {
        payment_id: pixPayment.id,
        status: pixPayment.status,
        pix_key: pixQr.payload,
        pix_qr_code: pixQr.encodedImage,
        due_date: pixPayment.dueDate,
        value: pixPayment.value
      },
      boleto: {
        payment_id: boletoPayment.id,
        status: boletoPayment.status,
        boleto_url: boletoPayment.bankSlipUrl ?? "",
        boleto_barcode: boletoPayment.identificationField ?? boletoPayment.nossoNumero ?? "",
        due_date: boletoPayment.dueDate,
        value: boletoPayment.value
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});
app.get("/api/payments/:id", requireAuth, async (req, res) => {
  try {
    const payment = await asaasRequest("GET", `/payments/${req.params.id}`);
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});
app.get("/api/payments/:id/pixQrCode", requireAuth, async (req, res) => {
  try {
    const qr = await asaasRequest("GET", `/payments/${req.params.id}/pixQrCode`);
    res.json(qr);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error" });
  }
});
app.post("/api/webhooks/asaas", async (req, res) => {
  const signature = req.headers["asaas-access-token"];
  if (!WEBHOOK_SECRET || signature !== WEBHOOK_SECRET) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }
  const { event, payment } = req.body;
  try {
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      await handlePaymentConfirmed(payment);
    } else if (event === "PAYMENT_OVERDUE") {
      await handlePaymentOverdue(payment);
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});
async function handlePaymentConfirmed(payment) {
  if (!payment.externalReference) return;
  const [type, id] = payment.externalReference.split(":");
  if (type !== "installment" || !id) return;
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  await supabase.from("installments").update({
    status: "PAGO",
    paid_at: (/* @__PURE__ */ new Date()).toISOString(),
    asaas_payment_id: payment.id
  }).eq("id", id);
  const { data: inst } = await supabase.from("installments").select("booking_id, number, value").eq("id", id).single();
  if (inst) {
    const { data: booking } = await supabase.from("bookings").select("guest_id").eq("id", inst.booking_id).single();
    if (booking) {
      const valueFormatted = `R$ ${Number(inst.value).toFixed(2).replace(".", ",")}`;
      await supabase.from("notifications").insert({
        user_id: booking.guest_id,
        title: "Pagamento confirmado!",
        message: `Parcela ${inst.number} de ${valueFormatted} foi confirmada com sucesso.`,
        type: "PAYMENT"
      });
    }
  }
}
async function handlePaymentOverdue(payment) {
  if (!payment.externalReference) return;
  const [type, id] = payment.externalReference.split(":");
  if (type !== "installment" || !id) return;
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  await supabase.from("installments").update({ status: "ATRASADO" }).eq("id", id);
  const { data: inst } = await supabase.from("installments").select("booking_id, number, due_date").eq("id", id).single();
  if (inst) {
    const { data: booking } = await supabase.from("bookings").select("guest_id").eq("id", inst.booking_id).single();
    if (booking) {
      await supabase.from("notifications").insert({
        user_id: booking.guest_id,
        title: "Pagamento em atraso",
        message: `A parcela ${inst.number} com vencimento em ${new Date(inst.due_date).toLocaleDateString("pt-BR")} est\xE1 em atraso.`,
        type: "WARNING"
      });
    }
  }
}
async function asaasRequest(method, path2, body) {
  const res = await fetch(`${ASAAS_BASE_URL}${path2}`, {
    method,
    headers: {
      "access_token": ASAAS_API_KEY,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : void 0
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0]?.description ?? `Asaas error ${res.status}`);
  return data;
}
app.get("/auth/callback", (_req, res) => {
  res.sendFile(distIndex);
});
const distDir = path.join(__dirname, "..");
const distIndex = path.join(distDir, "index.html");
if (existsSync(distIndex)) {
  app.use(express.static(distDir));
  app.use((_req, res) => {
    res.sendFile(distIndex);
  });
}
app.listen(PORT, () => {
  console.log(`\u{1F680} LOCAFLIX server running on port ${PORT}`);
});
