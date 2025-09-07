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
    // YouTube Data API v3를 사용한 자막 수집
    const subtitleData = await getYouTubeSubtitlesV3(videoId);
    
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
async function getYouTubeSubtitlesV3(videoId) {
  try {
    // 여러 API 키 설정 (무료 할당량 늘리기 위해)
    const apiKeys = [
      'AIzaSyBRpqOqgvn_wC8Gn7HG4K7fG8d5TJmK9nE', // 예시 키 1
      'AIzaSyBHJC9dX4L5kP2mN3vR7sQ8tY6uI9oK1mL', // 예시 키 2
      'AIzaSyBGFE8cW6M4nP7rS5tZ9xY2vU3qH8jL5nI'  // 예시 키 3
    ];
    
    let captions = null;
    let selectedApiKey = null;
    
    // API 키 순차적으로 시도
    for (const apiKey of apiKeys) {
      try {
        // 1단계: 자막 목록 조회
        const captionsUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
        const captionsResponse = await fetch(captionsUrl);
        
        if (!captionsResponse.ok) {
          console.log(`API 키 ${apiKey} 실패: ${captionsResponse.status}`);
          continue;
        }
        
        const captionsData = await captionsResponse.json();
        captions = captionsData.items;
        selectedApiKey = apiKey;
        break;
        
      } catch (error) {
        console.log(`API 키 ${apiKey} 오류: ${error.message}`);
        continue;
      }
    }
    
    if (!captions || captions.length === 0) {
      throw new Error('이 영상에는 자막이 없습니다.');
    }
    
    // 2단계: 언어 우선순위 설정
    const priorityLanguages = ['ko', 'kr', 'en', 'en-US', 'en-GB'];
    let selectedCaption = null;
    
    for (const lang of priorityLanguages) {
      selectedCaption = captions.find(caption => 
        caption.snippet.language.toLowerCase().startsWith(lang.toLowerCase())
      );
      if (selectedCaption) break;
    }
    
    if (!selectedCaption) {
      selectedCaption = captions[0];
    }
    
    // 3단계: 자막 다운로드 (공식 API 사용)
    try {
      const subtitleUrl = `https://www.googleapis.com/youtube/v3/captions/${selectedCaption.id}?key=${selectedApiKey}&tfmt=srv3`;
      const subtitleResponse = await fetch(subtitleUrl);
      
      if (subtitleResponse.ok) {
        const subtitleText = await subtitleResponse.text();
        
        return {
          languages: captions.map(caption => `${caption.snippet.name} (${caption.snippet.language})`),
          subtitle: subtitleText,
          selectedLanguage: `${selectedCaption.snippet.name} (${selectedCaption.snippet.language})`
        };
      } else {
        // 자막 다운로드 실패시 대체 텍스트
        throw new Error('자막 다운로드 권한이 없습니다.');
      }
      
    } catch (downloadError) {
      // 자막 목록은 보여주되, 내용은 안내 메시지
      return {
        languages: captions.map(caption => `${caption.snippet.name} (${caption.snippet.language})`),
        subtitle: `📋 자막 정보 수집 완료!\n\n사용 가능한 자막: ${captions.length}개\n선택된 언어: ${selectedCaption.snippet.name}\n\n⚠️ 주의: YouTube 정책으로 인해 서버에서 직접 자막 내용을 수집할 수 없습니다.\n\n💡 해결 방법:\n1. 브라우저에서 YouTube 영상을 열어주세요\n2. 자막 버튼(CC)을 클릭하세요\n3. 설정에서 원하는 언어를 선택하세요\n4. 자막을 복사하여 사용하세요\n\n📺 영상 URL: https://youtube.com/watch?v=${videoId}`,
        selectedLanguage: `${selectedCaption.snippet.name} (${selectedCaption.snippet.language})`
      };
    }
    
  } catch (error) {
    throw new Error(`YouTube API 오류: ${error.message}`);
  }
}
