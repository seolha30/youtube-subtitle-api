export default function handler(req, res) {
  res.json({ message: "작동함!", time: new Date().toISOString() });
}
