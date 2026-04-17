exports.handler = async () => {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!accessToken) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing INSTAGRAM_ACCESS_TOKEN' }),
    };
  }

  try {
    const endpoint = `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=9&access_token=${accessToken}`;
    const response = await fetch(endpoint);

    if (!response.ok) {
      const raw = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Instagram API request failed', details: raw }),
      };
    }

    const data = await response.json();
    const posts = (data.data || [])
      .filter((item) => ['IMAGE', 'CAROUSEL_ALBUM', 'VIDEO'].includes(item.media_type))
      .map((item) => ({
        id: item.id,
        image: item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url,
        permalink: item.permalink,
        caption: item.caption || '',
      }))
      .filter((item) => Boolean(item.image));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
      body: JSON.stringify({ posts }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unable to fetch Instagram feed', details: error.message }),
    };
  }
};
