import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentVideos, setCurrentVideos] = useState([]);
  const [allPages, setAllPages] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [pageToken, setPageToken] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [videosFadeIn, setVideosFadeIn] = useState(false);
  const [loadedVideos, setLoadedVideos] = useState(new Set());
  const [activeVideo, setActiveVideo] = useState(null);
  const [videoDurations, setVideoDurations] = useState({});

  const fetchVideoDurations = async (videoIds) => {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    const idsString = videoIds.join(',');
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${idsString}&key=${apiKey}`;

    try {
      const response = await axios.get(url);
      const durations = {};
      response.data.items.forEach(item => {
        const duration = item.contentDetails.duration;
        const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        
        const hours = (match[1] || '').replace('H', '');
        const minutes = (match[2] || '').replace('M', '');
        const seconds = (match[3] || '').replace('S', '');
        
        let formatted = '';
        if (hours) formatted += `${hours}:`;
        formatted += `${minutes || '0'}`;
        formatted += `:${seconds.padStart(2, '0')}`;
        
        durations[item.id] = formatted;
      });
      setVideoDurations(prev => ({ ...prev, ...durations }));
    } catch (error) {
      console.error('Error fetching video durations:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setVideosFadeIn(false);
    
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=9&videoEmbeddable=true&key=${apiKey}`;

    try {
      const response = await axios.get(url);
      const videos = response.data.items;
      
      await fetchVideoDurations(videos.map(video => video.id.videoId));
      
      const newPage = {
        videos: videos,
        nextPageToken: response.data.nextPageToken
      };
      
      setCurrentVideos(videos);
      setPageToken(response.data.nextPageToken);
      setAllPages([newPage]);
      setCurrentPage(0);
      setShowResults(true);
      
      setTimeout(() => {
        setVideosFadeIn(true);
      }, 100);
    } catch (error) {
      console.error("Error fetching videos:", error);
    }
  };

  const handlePageChange = async (getNextPage) => {
    setVideosFadeIn(false);
    
    setTimeout(async () => {
      await getNextPage();
      
      setTimeout(() => {
        setVideosFadeIn(true);
      }, 100);
    }, 300);
  };

  const handleNextPage = async () => {
    if (currentPage + 1 < allPages.length) {
      const nextPageVideos = allPages[currentPage + 1].videos;
      const missingDurations = nextPageVideos.filter(video => !videoDurations[video.id.videoId]);
      if (missingDurations.length > 0) {
        await fetchVideoDurations(missingDurations.map(video => video.id.videoId));
      }
      
      setCurrentPage(currentPage + 1);
      setCurrentVideos(nextPageVideos);
      setPageToken(allPages[currentPage + 1].nextPageToken);
      return;
    }

    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=9&videoEmbeddable=true&pageToken=${pageToken}&key=${apiKey}`;

    try {
      const response = await axios.get(url);
      const videos = response.data.items;
      
      await fetchVideoDurations(videos.map(video => video.id.videoId));
      
      const newPage = {
        videos: videos,
        nextPageToken: response.data.nextPageToken
      };
      
      setAllPages([...allPages, newPage]);
      setCurrentVideos(videos);
      setPageToken(response.data.nextPageToken);
      setCurrentPage(currentPage + 1);
    } catch (error) {
      console.error('Error fetching next page:', error);
    }
  };

  const handlePrevPage = async () => {
    if (currentPage > 0) {
      const prevPageVideos = allPages[currentPage - 1].videos;
      const missingDurations = prevPageVideos.filter(video => !videoDurations[video.id.videoId]);
      if (missingDurations.length > 0) {
        await fetchVideoDurations(missingDurations.map(video => video.id.videoId));
      }
      
      setCurrentPage(currentPage - 1);
      setCurrentVideos(prevPageVideos);
      setPageToken(allPages[currentPage - 1].nextPageToken);
    }
  };

  const handleVideoLoad = (videoId) => {
    setLoadedVideos(prev => new Set([...prev, videoId]));
  };

  const handleVideoClick = (video) => {
    setActiveVideo(video.id.videoId);
    
    setTimeout(() => {
      const iframe = document.querySelector(`iframe[src*="${video.id.videoId}"]`);
      if (iframe && iframe.contentDocument && iframe.contentDocument.body.innerHTML === "") {
        window.open(`https://www.youtube.com/watch?v=${video.id.videoId}`, '_blank');
        setActiveVideo(null);
      }
    }, 1000);
  };

  return (
    <div className="app">
      {!showResults ? (
        <div className={`search-container ${isTransitioning ? 'fade-out' : ''}`}>
          <form onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search for videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit">Search</button>
          </form>
        </div>
      ) : (
        <>
          <div className="menu-container">
            <button 
              className="menu-toggle" 
              aria-label="Menu"
            >
              ⋮
            </button>
            <div className="menu-dropdown">
              <button onClick={() => {
                setShowResults(false);
                setSearchQuery("");
                setCurrentVideos([]);
                setAllPages([]);
                setPageToken("");
                setCurrentPage(0);
              }}>
                New Search
              </button>
              <div className="pagination-controls">
                <button 
                  onClick={handlePrevPage} 
                  disabled={currentPage === 0}
                >
                  ←
                </button>
                <button 
                  onClick={handleNextPage}
                  disabled={!pageToken}
                >
                  →
                </button>
              </div>
            </div>
          </div>
          <div className={`video-grid ${videosFadeIn ? 'fade-in' : ''}`}>
            {currentVideos.map((video, index) => (
              <div 
                key={video.id.videoId} 
                className={`video-item ${videosFadeIn ? 'visible' : ''}`}
                style={{ transitionDelay: `${index * 0.1}s` }}
              >
                <div className="video-wrapper">
                  {activeVideo === video.id.videoId ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${video.id.videoId}?autoplay=1`}
                      frameBorder="0"
                      allowFullScreen
                      allow="autoplay"
                      title={video.snippet.title}
                    />
                  ) : (
                    <div 
                      className="thumbnail-container"
                      onClick={() => handleVideoClick(video)}
                    >
                      <img
                        src={video.snippet.thumbnails.high.url}
                        alt={video.snippet.title}
                        className="thumbnail"
                      />
                      <div className="play-button">▶</div>
                      <div className="video-title">
                        {video.snippet.title}
                      </div>
                      {videoDurations[video.id.videoId] && (
                        <div className="video-duration">
                          {videoDurations[video.id.videoId]}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
