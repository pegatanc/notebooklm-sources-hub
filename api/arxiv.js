// API proxy for arXiv — fetches and returns JSON
export default async function handler(req, res) {
  const { q = '', max = 10, start = 0 } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query param "q"' });

  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=${start}&max_results=${max}`;

  try {
    const resp = await fetch(url);
    const xml = await resp.text();

    // Parse Atom XML → JSON
    const entries = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    while ((match = entryRegex.exec(xml)) !== null) {
      const e = match[1];
      const get = (tag) => {
        const m = e.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
        return m ? m[1].trim() : '';
      };
      const getAttr = (tag, attr) => {
        const m = e.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`));
        return m ? m[1] : '';
      };
      const authors = [];
      const authorRegex = /<name>([^<]+)<\/name>/g;
      let am;
      while ((am = authorRegex.exec(e)) !== null) authors.push(am[1]);

      entries.push({
        title: get('title').replace(/\n/g, ' ').trim(),
        authors,
        abstract: get('summary').replace(/\n/g, ' ').trim(),
        published: get('published'),
        updated: get('updated'),
        doi: get('arxiv:doi') || get('doi'),
        pdfUrl: getAttr('link', 'title').includes('pdf') ? getAttr('link', 'href') : '',
        arxivUrl: get('id'),
        source: 'arXiv',
      });
    }

    res.status(200).json({ source: 'arXiv', total: entries.length, results: entries });
  } catch (err) {
    res.status(502).json({ error: 'arXiv fetch failed', detail: err.message });
  }
}
