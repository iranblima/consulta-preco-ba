// Cliente para o endpoint de busca do Preço da Hora Bahia
// Node 18.14+ (usa fetch nativo, sem dependências)

const BASE = process.env.PRECODAHORA_BASE || 'https://precodahora.ba.gov.br';

class PrecoDaHora {
  constructor({ userAgent = 'MeuApp/1.0 (contato@exemplo.com)' } = {}) {
    this.userAgent = userAgent;
    this.cookies = new Map(); // cookie jar simples: nome -> valor
    this.token = null;
    this._renovando = null;   // evita várias renovações ao mesmo tempo
  }

  // ---- cookies ----
  _guardarCookies(res) {
    const lista = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') || '').split(/,(?=\s*[^;,]+=)/);
    for (const c of lista) {
      const [par] = c.split(';');
      const i = par.indexOf('=');
      if (i > 0) this.cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
    }
  }

  _cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // ---- token ----
  async renovar() {
    if (this._renovando) return this._renovando; // reaproveita renovação em andamento
    this._renovando = (async () => {
      this.cookies.clear();
      const res = await fetch(`${BASE}/produtos/`, {
        headers: { 'User-Agent': this.userAgent },
      });
      this._guardarCookies(res);
      const html = await res.text();
      const m = html.match(/name="csrf_token"[^>]*value="([^"]+)"/)
             || html.match(/value="([^"]+)"[^>]*name="csrf_token"/);
      if (!m) throw new Error('csrf_token não encontrado no HTML — o site pode ter mudado');
      this.token = m[1];
    })();
    try {
      await this._renovando;
    } finally {
      this._renovando = null;
    }
  }

  // ---- busca ----
  async buscar({
    termo,
    latitude = -12.9711,
    longitude = -38.5108,
    raio = 15,
    pagina = 1,
    ordenar = 'preco.asc',
    horas = 72,
    gtin,
    categorias,
  } = {}) {
    const params = { termo, latitude, longitude, raio, pagina, ordenar, horas, gtin, categorias };
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') body.append(k, String(v));
    }

    if (!this.token) await this.renovar();

    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      const res = await fetch(`${BASE}/produtos/`, {
        method: 'POST',
        headers: {
          'User-Agent': this.userAgent,
          'X-CSRFToken': this.token,
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Referer': `${BASE}/produtos/`,
          'Origin': BASE,
          'Cookie': this._cookieHeader(),
        },
        body,
      });
      this._guardarCookies(res);

      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error(`Resposta não-JSON (HTTP ${res.status})`);
      }

      const naoAutorizado = res.status === 401 || res.status === 403 || json.codigo === 70;
      if (!naoAutorizado) return json;

      if (tentativa === 1) await this.renovar(); // token/sessão expirou: renova e tenta de novo
    }
    throw new Error('Acesso não autorizado mesmo após renovar o token');
  }
}

module.exports = { PrecoDaHora };
