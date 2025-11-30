import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
const JWT_SECRET = process.env.JWT_SECRET || "segredo"

console.log("🔌 Supabase conectado?")
console.log("URL:", process.env.SUPABASE_URL)
console.log("Chave:", process.env.SUPABASE_KEY ? "OK" : "ERRO - faltando SUPABASE_KEY")

// ---------------------- REGISTER ----------------------
app.post("/api/register", async (req, res) => {
  console.log("📩 [POST] /api/register")
  console.log("Body recebido:", req.body)

  const { nome, email, senha } = req.body

  const hash = await bcrypt.hash(senha, 10)
  console.log("🔐 Senha criptografada:", hash)

  const { error } = await supabase.from("usuarios").insert([{ nome, email, senha: hash }])

  if (error) {
    console.error("❌ Erro ao cadastrar usuário:", error.message)
    return res.status(400).json({ error: error.message })
  }

  console.log("✅ Usuário cadastrado:", email)
  res.json({ message: "Usuário cadastrado" })
})


// ---------------------- LOGIN ----------------------
app.post("/api/login", async (req, res) => {
  console.log("📩 [POST] /api/login")
  console.log("Body recebido:", req.body)

  const { email, senha } = req.body

  // 🔒 VALIDAÇÃO — impedindo email/senha vazios
  if (!email || !senha || email.trim() === "" || senha.trim() === "") {
    return res.status(400).json({ error: "Email e senha são obrigatórios" })
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email)
    .single()

  if (error || !data) {
    console.error("❌ Login falhou: email não encontrado")
    return res.status(401).json({ error: "Credenciais inválidas" })
  }

  console.log("👤 Usuário encontrado:", data.email)

  const valid = await bcrypt.compare(senha, data.senha)
  console.log("🔍 Senha válida?", valid)

  if (!valid) {
    console.error("❌ Senha incorreta")
    return res.status(401).json({ error: "Senha incorreta" })
  }

  const token = jwt.sign({ id: data.id, email: data.email }, JWT_SECRET, { expiresIn: "2h" })
  console.log("🔑 Token gerado:", token)

  res.json({ token, nome: data.nome, userId: data.id })
})


//-------------GET ITENS-------------
app.get("/api/itens", async (req, res) => {
  console.log("📦 [GET] /api/itens — buscando itens do cardápio...");

  const { data, error } = await supabase.from("itens").select("*");

  if (error) {
    console.error("❌ Erro ao buscar itens:", error.message);
    return res.status(400).json({ error: error.message });
  }

  console.log(`🍽️ ${data.length} itens encontrados:`);
  data.forEach(i => console.log(`- ${i.nome} (R$ ${i.preco})`));

  res.json(data);
});

// ---------------------- CRIAR PEDIDOS ----------------------
app.post("/api/pedidos", async (req, res) => {
  console.log("📩 [POST] /api/pedidos")
  console.log("Body recebido:", req.body)

  const { userId, itens } = req.body

  const { error } = await supabase.from("pedidos").insert([{ user_id: userId, itens }])

  if (error) {
    console.error("❌ Erro ao criar pedido:", error.message)
    return res.status(400).json({ error: error.message })
  }

  console.log("🧾 Pedido criado para o usuário:", userId)
  res.json({ message: "Pedido criado" })
})

// ---------------------- LISTAR PEDIDOS ----------------------
app.get("/api/pedidos/:id", async (req, res) => {
  console.log("📩 [GET] /api/pedidos/:id")
  console.log("ID recebido:", req.params.id)

  const { id } = req.params

  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("user_id", id)

  if (error) {
    console.error("❌ Erro ao listar pedidos:", error.message)
    return res.status(400).json({ error: error.message })
  }

  console.log("📦 Pedidos encontrados:", data.length)
  res.json(data)
})

// ---------------------- EXCLUIR PEDIDO ----------------------
app.delete("/api/pedidos/:id", async (req, res) => {
  const { id } = req.params;

  console.log("🗑️ [DELETE] /api/pedidos/" + id);

  try {
    console.log("🔍 Verificando se pedido existe...");

    const { data: pedidoExistente, error: erroBusca } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", id)
      .single();

    if (erroBusca || !pedidoExistente) {
      console.error("❌ Pedido não encontrado:", erroBusca?.message);
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    console.log("📦 Pedido encontrado:", pedidoExistente);

    console.log("🚮 Excluindo pedido...");
    const { error: erroDelete } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", id);

    if (erroDelete) {
      console.error("❌ Erro ao excluir pedido:", erroDelete.message);
      return res.status(400).json({ error: erroDelete.message });
    }

    console.log("✅ Pedido excluído com sucesso! ID:", id);
    res.json({ message: "Pedido excluído com sucesso" });

  } catch (err) {
    console.error("🔥 Erro inesperado ao excluir pedido:", err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// ---------------------- ALTERAR SENHA ----------------------
app.put("/api/usuario/:id/senha", async (req, res) => {
  console.log("📩 [PUT] /api/usuario/:id/senha")
  console.log("ID recebido:", req.params.id)
  console.log("Body recebido:", req.body)

  const { id } = req.params
  const { novaSenha } = req.body

  const hash = await bcrypt.hash(novaSenha, 10)
  console.log("🔐 Nova senha criptografada:", hash)

  const { error } = await supabase
    .from("usuarios")
    .update({ senha: hash })
    .eq("id", id)

  if (error) {
    console.error("❌ Erro ao alterar senha:", error.message)
    return res.status(400).json({ error: error.message })
  }

  console.log("🔄 Senha alterada para o usuário:", id)
  res.json({ message: "Senha alterada" })
})


// ---------------------- BUSCAR USUÁRIO ----------------------
app.get("/api/usuario/:id", async (req, res) => {
  console.log("📩 [GET] /api/usuario/:id")
  console.log("ID recebido:", req.params.id)

  const { id } = req.params

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email")
    .eq("id", id)
    .single()

  if (error) {
    console.error("❌ Erro ao buscar usuário:", error.message)
    return res.status(400).json({ error: error.message })
  }

  console.log("👤 Usuário encontrado:", data)
  res.json(data)
})


// ---------------------- SERVIDOR ----------------------
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("🚀 Servidor rodando na porta", PORT))
