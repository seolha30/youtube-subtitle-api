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
    // 실제 작동하는 무료 API 사용
    const subtitleData = await getSubtitlesFromFreeAPI(videoId);
    
    return res.json({
      success: true,
      videoId: videoId,
      availableLanguages: subtitleData.languages,
      subtitle: subtitleData.subtitle,
      language: subtitleData.selectedLanguage
    });
    
  } catch (error) {
    console.error('자막 수집 오류:', error);
    return res.json({ 
      error: '자막 수집 실패', 
      message: error.message,
      videoId: videoId
    });
  }
}

// 무료 API들 시도
async function getSubtitlesFromFreeAPI(videoId) {
  const freeAPIs = [
    {
      name: 'youtube-transcript-api',
      url: `https://youtube-transcript-api.wl.r.appspot.com/api/v1/transcript?video_id=${videoId}`,
      parser: parseTranscriptAPI
    },
    {
      name: 'subtitle-horse',
      url: `https://subtitle-horse.p.rapidapi.com/youtube/subtitles?videoId=${videoId}`,
      parser: parseSubtitleHorse,
      headers: {
        'X-RapidAPI-Key': 'demo', // 무료 데모 키
        'X-RapidAPI-Host': 'subtitle-horse.p.rapidapi.com'
      }
    },
    {
      name: 'youtube-captions-api',
      url: `https://api.streamelements.com/kappa/v2/youtube/video/${videoId}/captions`,
      parser: parseStreamElements
    }
  ];
  
  for (const api of freeAPIs) {
    try {
      console.log(`${api.name} 시도 중...`);
      
      const options = {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...(api.headers || {})
        }
      };
      
      const response = await fetch(api.url, options);
      
      if (response.ok) {
        const data = await response.json();
        const result = api.parser(data, videoId);
        
        if (result.subtitle && result.subtitle.length > 10) {
          console.log(`${api.name} 성공!`);
          return result;
        }
      }
      
    } catch (error) {
      console.log(`${api.name} 실패: ${error.message}`);
      continue;
    }
  }
  
  throw new Error('모든 자막 API에서 수집 실패');
}

// API 응답 파서들
function parseTranscriptAPI(data, videoId) {
  try {
    if (data && data.length > 0) {
      const subtitle = data.map((item, index) => {
        const startTime = parseFloat(item.start || 0);
        const minutes = Math.floor(startTime / 60);
        const seconds = Math.floor(startTime % 60);
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        return `[${timeStr}] ${item.text}`;
      }).join('\n');
      
      return {
        languages: ['Auto-detected'],
        subtitle: subtitle,
        selectedLanguage: 'Auto-detected'
      };
    }
  } catch (error) {
    console.error('TranscriptAPI 파싱 오류:', error);
  }
  
  return { languages: [], subtitle: '', selectedLanguage: '' };
}

function parseSubtitleHorse(data, videoId) {
  try {
    if (data && data.subtitles && data.subtitles.length > 0) {
      const subtitle = data.subtitles.map((item, index) => {
        return `[${item.start}] ${item.text}`;
      }).join('\n');
      
      return {
        languages: [data.language || 'Unknown'],
        subtitle: subtitle,
        selectedLanguage: data.language || 'Unknown'
      };
    }
  } catch (error) {
    console.error('SubtitleHorse 파싱 오류:', error);
  }
  
  return { languages: [], subtitle: '', selectedLanguage: '' };
}

function parseStreamElements(data, videoId) {
  try {
    if (data && data.captions && data.captions.length > 0) {
      const subtitle = data.captions.map((item, index) => {
        const startTime = parseFloat(item.startTime || 0);
        const minutes = Math.floor(startTime / 60);
        const seconds = Math.floor(startTime % 60);
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        return `[${timeStr}] ${item.text}`;
      }).join('\n');
      
      return {
        languages: ['Auto-detected'],
        subtitle: subtitle,
        selectedLanguage: 'Auto-detected'
      };
    }
  } catch (error) {
    console.error('StreamElements 파싱 오류:', error);
  }
  
  return { languages: [], subtitle: '', selectedLanguage: '' };
}
