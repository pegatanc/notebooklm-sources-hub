// API proxy for PubMed NCBI E-utilities — fetches and returns JSON
export default async function handler(req, res) {
  const { q = '', max = 10 } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query param "q"' });

  const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const DB = 'pubmed';

  try {
    // Step 1: esearch — get PMIDs
    const searchUrl = `${EUTILS}/esearch.fcgi?db=${DB}&term=${encodeURIComponent(q)}&retmax=${max}&retmode=json`;
    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();
    const ids = searchData?.esearchresult?.idlist || [];

    if (ids.length === 0) {
      return res.status(200).json({ source: 'PubMed', total: 0, results: [] });
    }

    // Step 2: esummary — get article metadata
    const summaryUrl = `${EUTILS}/esummary.fcgi?db=${DB}&id=${ids.join(',')}&retmode=json`;
    const summaryResp = await fetch(summaryUrl);
    const summaryData = await summaryResp.json();

    const results = ids.map(id => {
      const a = summaryData?.result?.[id];
      if (!a) return null;
      return {
        title: a.title || '',
        authors: (a.authors || []).map(au => au.name),
        abstract: '', // esummary doesn't include abstract; would need efetch
        published: (a.pubdate || '').split(' ')[0],
        journal: a.fulljournalname || a.source || '',
        pmid: id,
        pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        source: 'PubMed',
      };
    }).filter(Boolean);

    res.status(200).json({ source: 'PubMed', total: results.length, results });
  } catch (err) {
    res.status(502).json({ error: 'PubMed fetch failed', detail: err.message });
  }
}
