// Função serverless da Vercel: GET /api/buscar?termo=arroz&pagina=1
const { PrecoDaHora } = require('../lib/precodahora');

// Parâmetros fixos da busca
const PADRAO = {
  latitude: -13.8577,
  longitude: -40.0836,
  raio: 15,
  ordenar: 'preco.asc',
  horas: 72,
};

// Fora do handler: reaproveitada enquanto a função estiver "quente" (token e cookie em memória)
const api = new PrecoDaHora({ userAgent: 'PrecoLocal/1.0' });

module.exports = async (req, res) => {
  const termo = String(req.query.termo || '').trim();
  const pagina = Number(req.query.pagina) || 1;

  if (!termo) return res.status(400).json({ erro: 'Informe o produto' });

  try {
    const dados = await api.buscar({ ...PADRAO, termo, pagina });
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800'); // cache de 10 min na CDN
    return res.status(200).json(dados);
  } catch (e) {
    console.error(e);
    return res.status(502).json({ erro: e.message });
  }
};
