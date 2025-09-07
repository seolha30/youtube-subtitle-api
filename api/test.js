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
    // youtube-caption-extractor로 자막 수집
    const subtitles = await getSubtitles({ 
      videoID: videoId, 
      lang: 'ko'  // 한국어 우선, 없으면 자동으로 다른 언어
    });
    
    const videoDetails = await getVideoDetails({ 
      videoID: videoId, 
      lang: 'ko' 
    });
    
    // 자막을 시간대별로 포맷팅
    const formattedSubtitle = formatSubtitles(subtitles);
    
    // 사용 가능한 언어 정보 (실제로는 더 많을 수 있음)
    const availableLanguages = ['한국어 (ko)', '영어 (en)', '자동 감지'];
    
    return res.json({
      success: true,
      videoId: videoId,
      availableLanguages: availableLanguages,
      subtitle: formattedSubtitle,
      language: '자동 선택',
      videoTitle: videoDetails.title || '제목 없음',
      videoDescription: videoDetails.description || '설명 없음'
    });
    
  } catch (error) {
    console.error('자막 수집 오류:', error);
    
    // 에러 시 영어로 재시도
    try {
      const englishSubtitles = await getSubtitles({ 
        videoID: videoId, 
        lang: 'en' 
      });
      
      const formattedSubtitle = formatSubtitles(englishSubtitles);
      
      return res.json({
        success: true,
        videoId: videoId,
        availableLanguages: ['영어 (en)'],
        subtitle: formattedSubtitle,
        language: '영어 (자동 감지)',
        videoTitle: '영상 제목',
        note: '한국어 자막이 없어 영어로 대체되었습니다.'
      });
      
    } catch (secondError) {
      return res.json({ 
        error: '자막 수집 실패', 
        message: error.message,
        videoId: videoId,
        details: '한국어와 영어 자막 모두 수집에 실패했습니다.'
      });
    }
  }
}

// 자막 포맷팅 함수
function formatSubtitles(subtitles) {
  if (!subtitles || subtitles.length === 0) {
    return '자막이 없습니다.';
  }
  
  return subtitles.map((subtitle, index) => {
    const startTime = parseFloat(subtitle.start);
    const minutes = Math.floor(startTime / 60);
    const seconds = Math.floor(startTime % 60);
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    return `[${timeStr}] ${subtitle.text}`;
  }).join('\n');
}
