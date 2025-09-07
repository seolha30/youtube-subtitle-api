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
    // 유튜브 자막 수집
    const subtitleData = await getYouTubeSubtitles(videoId);
    
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

// YouTube 자막 수집 메인 함수
async function getYouTubeSubtitles(videoId) {
  try {
    // 1단계: 자막 목록 조회
    const captionTracks = await getCaptionTrackList(videoId);
    
    if (!captionTracks || captionTracks.length === 0) {
      throw new Error('이 영상에는 자막이 없습니다.');
    }
    
    // 2단계: 언어 우선순위 설정 (한국어 > 영어 > 기타)
    const priorityLanguages = ['ko', 'kr', 'en', 'en-US', 'en-GB'];
    let selectedTrack = null;
    
    // 우선순위 언어 찾기
    for (const lang of priorityLanguages) {
      selectedTrack = captionTracks.find(track => 
        track.languageCode.toLowerCase().startsWith(lang.toLowerCase())
      );
      if (selectedTrack) break;
    }
    
    // 우선순위 언어가 없으면 첫 번째 자막 사용
    if (!selectedTrack) {
      selectedTrack = captionTracks[0];
    }
    
    // 3단계: 자막 다운로드
    const subtitleText = await downloadSubtitle(selectedTrack.baseUrl);
    
    return {
      languages: captionTracks.map(track => `${track.name} (${track.languageCode})`),
      subtitle: subtitleText,
      selectedLanguage: `${selectedTrack.name} (${selectedTrack.languageCode})`
    };
    
  } catch (error) {
    throw new Error(`자막 수집 실패: ${error.message}`);
  }
}

// YouTube 자막 트랙 목록 조회
async function getCaptionTrackList(videoId) {
  try {
    // YouTube 페이지에서 player response 데이터 추출
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`YouTube 페이지 로드 실패: ${response.status}`);
    }
    
    const html = await response.text();
    
    // ytInitialPlayerResponse에서 자막 정보 추출
    let playerResponse = null;
    
    // 방법 1: ytInitialPlayerResponse 찾기
    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (playerResponseMatch) {
      try {
        playerResponse = JSON.parse(playerResponseMatch[1]);
      } catch (e) {
        console.log('PlayerResponse 파싱 실패, 다른 방법 시도');
      }
    }
    
    // 방법 2: var ytInitialPlayerResponse 찾기
    if (!playerResponse) {
      const altMatch = html.match(/var\s+ytInitialPlayerResponse\s*=\s*({.+?});/);
      if (altMatch) {
        try {
          playerResponse = JSON.parse(altMatch[1]);
        } catch (e) {
          console.log('대체 PlayerResponse 파싱 실패');
        }
      }
    }
    
    if (!playerResponse) {
      throw new Error('YouTube 플레이어 정보를 찾을 수 없습니다.');
    }
    
    // 자막 트랙 추출
    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!captions || captions.length === 0) {
      throw new Error('자막 정보를 찾을 수 없습니다.');
    }
    
    return captions.map(track => ({
      name: track.name?.simpleText || track.languageCode,
      languageCode: track.languageCode,
      baseUrl: track.baseUrl
    }));
    
  } catch (error) {
    throw new Error(`자막 목록 조회 실패: ${error.message}`);
  }
}

// 자막 다운로드 및 파싱
async function downloadSubtitle(baseUrl) {
  try {
    // XML 형태의 자막 다운로드
    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`자막 다운로드 실패: ${response.status}`);
    }
    
    const xmlData = await response.text();
    
    // XML 파싱하여 텍스트만 추출
    const subtitleText = parseSubtitleXML(xmlData);
    
    return subtitleText;
    
  } catch (error) {
    throw new Error(`자막 다운로드 실패: ${error.message}`);
  }
}

// XML 자막을 텍스트로 변환
function parseSubtitleXML(xmlData) {
  try {
    // XML에서 텍스트 추출 (간단한 정규식 사용)
    const textMatches = xmlData.match(/<text[^>]*>(.*?)<\/text>/g);
    
    if (!textMatches) {
      return '자막 텍스트를 찾을 수 없습니다.';
    }
    
    const subtitleLines = textMatches.map(match => {
      // HTML 태그 제거 및 HTML 엔티티 디코딩
      let text = match.replace(/<\/?[^>]+(>|$)/g, '');
      text = decodeHTMLEntities(text);
      return text.trim();
    }).filter(line => line.length > 0);
    
    return subtitleLines.join('\n');
    
  } catch (error) {
    return `자막 파싱 오류: ${error.message}`;
  }
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
