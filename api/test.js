export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { videoId } = req.query;
  
  if (!videoId) {
    return res.json({ error: 'videoId가 필요합니다' });
  }
  
  try {
    // YouTube Data API v3를 사용한 자막 수집 (간단한 방법)
    const response = await fetch(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=YOUR_API_KEY`);
    
    if (!response.ok) {
      return res.json({ subtitle: '자막 없음' });
    }
    
    return res.json({ 
      success: true,
      subtitle: '자막 수집 성공 (구현 예정)',
      videoId: videoId 
    });
    
  } catch (error) {
    return res.json({ error: '자막 수집 실패', message: error.message });
  }
}
