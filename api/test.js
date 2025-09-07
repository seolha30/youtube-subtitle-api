import { getSubtitles, getVideoDetails } from 'youtube-caption-extractor';

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
    // 한국어 우선으로 자막과 비디오 정보 수집
    const [subtitles, videoDetails] = await Promise.all([
      getSubtitles({ videoID: videoId, lang: 'ko' }).catch(() => 
        getSubtitles({ videoID: videoId, lang: 'en' })
      ),
      getVideoDetails({ videoID: videoId, lang: 'ko' })
    ]);
    
    const formattedSubtitle = formatSubtitles(subtitles);
    
    return res.json({
      success: true,
      videoId: videoId,
      videoTitle: videoDetails.title, // 실제 유튜브 제목 그대로
      subtitle: formattedSubtitle
    });
    
  } catch (error) {
    return res.json({ 
      error: '자막 수집 실패', 
      message: error.message,
      videoId: videoId
    });
  }
}

function formatSubtitles(subtitles) {
  if (!subtitles || subtitles.length === 0) {
    return '자막이 없습니다.';
  }
  
  return subtitles.map((subtitle) => {
    const startTime = parseFloat(subtitle.start);
    const minutes = Math.floor(startTime / 60);
    const seconds = Math.floor(startTime % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    return `[${timeStr}] ${subtitle.text}`;
  }).join('\n');
}
