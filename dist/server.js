var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/index.ts
var import_express = __toESM(require("express"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_url = require("node:url");
var import_node_fs = require("node:fs");
var import_meta = {};
var __dirname = import_node_path.default.dirname((0, import_node_url.fileURLToPath)(import_meta.url));
var app = (0, import_express.default)();
var PORT = process.env.PORT ?? 3e3;
var ASAAS_API_KEY = (process.env.ASAAS_API_KEY ?? "").replace(/^\\+/, "").trim();
var ASAAS_BASE_URL = process.env.ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
var WEBHOOK_SECRET = process.env.ASAAS_WEBHOOK_SECRET ?? "";
app.use(import_express.default.json());
app.set("trust proxy", true);
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
app.get("/api/client-ip", (req, res) => {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.headers["x-real-ip"] ?? req.socket.remoteAddress ?? "0.0.0.0";
  res.json({ ip });
});
app.post("/api/payments/create-pix", requireAuth, async (req, res) => {
  try {
    const { customer, value, dueDate, description, externalReference } = req.body;
    if (!ASAAS_API_KEY) {
      res.status(503).json({ error: "Integra\xE7\xE3o Asaas n\xE3o configurada. Defina ASAAS_API_KEY no servidor." });
      return;
    }
    if (!customer || !value || !dueDate) {
      res.status(400).json({ error: "customer, value and dueDate are required" });
      return;
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
      value,
      dueDate,
      description,
      externalReference,
      fine: { value: 2, type: "PERCENTAGE" },
      interest: { value: 1, type: "MONTHLY" }
    });
    const pixRes = await asaasRequest("GET", `/payments/${paymentRes.id}/pixQrCode`);
    const { installment_id } = req.body;
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
    const customerRes = await asaasRequest("POST", "/customers", {
      name: customer.name,
      cpfCnpj: customer.cpf?.replace(/\D/g, ""),
      email: customer.email,
      mobilePhone: customer.phone?.replace(/\D/g, "")
    });
    const basePayload = {
      customer: customerRes.id,
      value,
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
  if (WEBHOOK_SECRET) {
    const signature = req.headers["asaas-access-token"];
    if (signature !== WEBHOOK_SECRET) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }
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
var distDir = import_node_path.default.join(__dirname, "..");
var distIndex = import_node_path.default.join(distDir, "index.html");
if ((0, import_node_fs.existsSync)(distIndex)) {
  app.use(import_express.default.static(distDir));
  app.use((_req, res) => {
    res.sendFile(distIndex);
  });
}
app.listen(PORT, () => {
  console.log(`\u{1F680} LOCAFLIX server running on port ${PORT}`);
});
