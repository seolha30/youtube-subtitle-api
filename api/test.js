export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { videoId, apiKey } = req.query;
  
  if (!videoId) {
    return res.json({ error: 'videoId가 필요합니다' });
  }
  
  if (!apiKey) {
    return res.json({ error: 'API 키가 필요합니다' });
  }
  
  try {
    // YouTube Data API v3를 사용한 자막 수집
    const subtitleData = await getYouTubeSubtitlesV3(videoId, apiKey);
    
    return res.json({
      success: true,
      videoId: videoId,
      availableLanguages: subtitleData.languages,
      subtitle: subtitleData.subtitle,
      language: subtitleData.selectedLanguage,
      method: 'YouTube Data API v3'
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

// YouTube Data API v3를 사용한 자막 수집
async function getYouTubeSubtitlesV3(videoId, apiKey) {
  try {
    // 1단계: 자막 목록 조회
    const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
    const captionsResponse = await fetch(captionsUrl);
    
    if (!captionsResponse.ok) {
      const errorData = await captionsResponse.json().catch(() => ({}));
      throw new Error(`API 요청 실패 (${captionsResponse.status}): ${errorData.error?.message || '알 수 없는 오류'}`);
    }
    
    const captionsData = await captionsResponse.json();
    const captions = captionsData.items || [];
    
    if (captions.length === 0) {
      throw new Error('이 영상에는 자막이 없습니다.');
    }
    
    // 2단계: 언어 우선순위 설정
    const priorityLanguages = ['ko', 'kr', 'en', 'en-US', 'en-GB'];
    let selectedCaption = null;
    
    // 우선순위 언어 찾기
    for (const lang of priorityLanguages) {
      selectedCaption = captions.find(caption => 
        caption.snippet.language.toLowerCase().startsWith(lang.toLowerCase())
      );
      if (selectedCaption) break;
    }
    
    // 우선순위 언어가 없으면 첫 번째 자막 사용
    if (!selectedCaption) {
      selectedCaption = captions[0];
    }
    
    // 3단계: 자막 다운로드 시도
    let subtitleText = '';
    
    try {
      // 방법 1: 공식 API로 자막 다운로드 시도
      const subtitleUrl = `https://www.googleapis.com/youtube/v3/captions/${selectedCaption.id}?key=${apiKey}&tfmt=srv3`;
      const subtitleResponse = await fetch(subtitleUrl);
      
      if (subtitleResponse.ok) {
        subtitleText = await subtitleResponse.text();
        // SRV3 형식 파싱
        subtitleText = parseSRV3Format(subtitleText);
      } else {
        throw new Error('자막 다운로드 권한 없음');
      }
    } catch (downloadError) {
      // 방법 2: 대안 방법 - 자막 정보만 제공
      subtitleText = generateSubtitleInfo(captions, selectedCaption, videoId);
    }
    
    return {
      languages: captions.map(caption => `${caption.snippet.name} (${caption.snippet.language})`),
      subtitle: subtitleText,
      selectedLanguage: `${selectedCaption.snippet.name} (${selectedCaption.snippet.language})`
    };
    
  } catch (error) {
    throw new Error(`YouTube API 오류: ${error.message}`);
  }
}

// SRV3 형식 파싱 (YouTube 자막 형식)
function parseSRV3Format(srv3Data) {
  try {
    // SRV3는 XML 형식
    const textMatches = srv3Data.match(/<text[^>]*>(.*?)<\/text>/gs);
    
    if (!textMatches || textMatches.length === 0) {
      return '자막 텍스트를 파싱할 수 없습니다.';
    }
    
    const subtitleLines = textMatches.map(match => {
      // 시간 정보 추출
      const startMatch = match.match(/start="([^"]+)"/);
      const startTime = startMatch ? parseFloat(startMatch[1]) : 0;
      
      // 텍스트 추출
      let text = match.replace(/<\/?[^>]+(>|$)/g, '');
      text = decodeHTMLEntities(text);
      
      // 시간을 분:초 형식으로 변환
      const minutes = Math.floor(startTime / 60);
      const seconds = Math.floor(startTime % 60);
      const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      return `[${timeStr}] ${text.trim()}`;
    }).filter(line => line.length > 10); // 너무 짧은 라인 제거
    
    return subtitleLines.join('\n');
    
  } catch (error) {
    return `SRV3 파싱 오류: ${error.message}`;
  }
}

// 자막 정보 생성 (다운로드 실패시 대안)
function generateSubtitleInfo(captions, selectedCaption, videoId) {
  const languageList = captions.map(caption => 
    `• ${caption.snippet.name} (${caption.snippet.language})`
  ).join('\n');
  
  return `🎯 자막 정보 수집 완료!

📺 비디오 ID: ${videoId}
⏰ 수집 시간: ${new Date().toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'})}

📋 사용 가능한 자막 (${captions.length}개):
${languageList}

🎯 선택된 자막: ${selectedCaption.snippet.name} (${selectedCaption.snippet.language})

⚠️ 자막 내용 수집 제한:
YouTube 정책으로 인해 자막 텍스트를 직접 수집할 수 없습니다.

💡 자막 확인 방법:
1. YouTube에서 영상 열기: https://youtube.com/watch?v=${videoId}
2. 자막(CC) 버튼 클릭
3. 설정에서 "${selectedCaption.snippet.name}" 선택
4. 자막 확인 및 수동 복사

🔧 기술적 이유:
- YouTube Data API는 자막 목록 조회만 허용
- 자막 내용 다운로드는 채널 소유자만 가능
- CORS 및 인증 제한`;
}

// HTML 엔티티 디코딩
function decodeHTMLEntities(text) {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '='
  };
  
  return text.replace(/&[^;]+;/g, (entity) => {
    return entities[entity] || entity;
  });
}
