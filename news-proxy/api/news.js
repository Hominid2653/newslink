export default async function handler(req, res) {
  // 1. Get parameters from your frontend request
  const { query, category, page } = req.query;
  const API_KEY = process.env.NEWS_API_KEY;
