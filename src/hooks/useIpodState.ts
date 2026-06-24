"use client";
import { useState, useRef, useEffect } from 'react';
import { YouTubePlayer } from 'react-youtube';
import { searchYouTube, YouTubeVideo } from '../lib/youtube-search';
import { fetchPlaylistItems, fetchVideoDetails } from '../lib/youtube-api';
import { usePlayer } from '../context/PlayerContext';

export interface SongItem {
    id: string;
    url: string;
    title: string;
    channel?: string;
    fromPlaylist?: boolean;
    playlistId?: string;
    playlistTitle?: string;
}

export function useIpodState() {
    // --- Playback State ---
    const [hasStarted, setHasStarted] = useState(false);
    const [showHome, setShowHome] = useState(false);
    const [queue, setQueue] = useState<SongItem[]>([]);
    const [history, setHistory] = useState<SongItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isLooping, setIsLooping] = useState(false);

    // --- Player State ---
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(100);
    const [isMuted, setIsMuted] = useState(false);

    // --- Search State ---
    const [videoUrl, setVideoUrl] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<YouTubeVideo[]>([]);
    const [searchError, setSearchError] = useState<string | null>(null);

    // --- Refs ---
    // playerRef holds the actual YouTube player instance
    const playerRef = useRef<YouTubePlayer | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- Context ---
    // sync local state to global context so other components can access it
    const { 
        setHistory: setCtxHistory, 
        setQueue: setCtxQueue, 
        setCurrentIndex: setCtxCurrentIndex,
        registerPlayHandler 
    } = usePlayer();

    // --- Computed ---
    // automatically figure out current video ID from queue + index
    const currentVideoId = currentIndex >= 0 && queue[currentIndex] 
        ? queue[currentIndex].id 
        : null;

    // --- Sync to Context ---
    // whenever local state changes → update global context
    useEffect(() => { setCtxHistory(history); }, [history]);
    useEffect(() => { setCtxQueue(queue); }, [queue]);
    useEffect(() => { setCtxCurrentIndex(currentIndex); }, [currentIndex]);

    // reset loop when song changes
    useEffect(() => { setIsLooping(false); }, [currentVideoId]);

    // --- Register Play Handler ---
    // lets drawers (history, queue) trigger playback through context
    useEffect(() => {
        registerPlayHandler((type, index) => {
            if (type === 'history') playHistoryItem(index);
            else if (type === 'queue') setCurrentIndex(index);
        });
    }, [registerPlayHandler, history, queue]);

    // --- YouTube Player Handlers ---

    // called when YouTube player is ready
    const handlePlayerReady = (event: any) => {
        playerRef.current = event.target;
        if (event.target.getPlayerState() !== 1) {
            event.target.playVideo();
        }
    };

    // called when YouTube player state changes
    // 1 = playing, 2 = paused, 0 = ended
    const handleStateChange = (event: any) => {
        if (event.data === 1) setIsPlaying(true);   // playing
        if (event.data === 2) setIsPlaying(false);  // paused
        if (event.data === 0) {                      // ended
            setIsPlaying(false);
            if (isLooping) {
                // restart the same song
                event.target.seekTo(0);
                event.target.playVideo();
                return;
            }
            // auto play next song if available
            if (currentIndex < queue.length - 1) {
                playNext();
            }
        }
    };

    // --- Search & Play ---

    // handles search — user types song name or pastes URL
    const handleConfirm = async () => {
        if (!videoUrl.trim()) return;
        setIsSearching(true);
        setSearchError(null);
        const { items, error } = await searchYouTube(videoUrl);
        if (error) { setSearchError(error); setIsSearching(false); return; }
        if (!items || items.length === 0) { 
            setSearchError("No results found"); 
            setIsSearching(false); 
            return; 
        }
        setSearchResults(items);
        setIsSearching(false);
    };

    // plays a video from URL — handles both single videos and playlists
    const playVideoFromUrl = async (
        url: string, 
        channelName?: string, 
        videoTitle?: string
    ) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const listRegExp = /[?&]list=([^#&?]+)/;
        const match = url.match(regExp);
        const listMatch = url.match(listRegExp);

        // if URL contains a playlist ID → load entire playlist
        if (listMatch && listMatch[1]) {
            const playlistId = listMatch[1];
            const playlistItems = await fetchPlaylistItems(playlistId);
            if (playlistItems.items.length > 0) {
                const newItems: SongItem[] = playlistItems.items.map((item: any) => ({
                    id: item.id,
                    url: item.url,
                    title: item.title,
                    channel: item.channel,
                    fromPlaylist: true,
                    playlistId,
                    playlistTitle: playlistItems.title
                }));
                setHistory(prev => [...prev, ...newItems]);
                setQueue(newItems);
                // if URL points to specific video in playlist → jump to it
                let jumpIndex = 0;
                if (match && match[2] && match[2].length === 11) {
                    const specificIndex = newItems.findIndex(h => h.id === match[2]);
                    if (specificIndex !== -1) jumpIndex = specificIndex;
                }
                setCurrentIndex(jumpIndex);
                setHasStarted(true);
                setVideoUrl('');
            }
            return;
        }

        // single video URL
        if (match && match[2].length === 11) {
            const newId = match[2];
            let title = videoTitle || 'Loading title...';
            let channel = channelName;

            // fetch video details if not provided
            if (!videoTitle || !channelName) {
                try {
                    const details = await fetchVideoDetails(newId);
                    if (details) { 
                        title = details.title; 
                        channel = details.channel; 
                    }
                } catch (err) { 
                    console.error(err); 
                }
            }

            const newItem: SongItem = { 
                id: newId, 
                url, 
                title, 
                channel, 
                fromPlaylist: false 
            };

            // remove duplicate if same song exists in history
            setHistory(prev => {
                const filtered = prev.filter(item => item.id !== newId);
                const nextHistory = [...filtered, newItem];
                setQueue(nextHistory);
                setCurrentIndex(nextHistory.length - 1);
                return nextHistory;
            });

            setVideoUrl('');
            setHasStarted(true);
            setShowHome(false);
        }
    };

    // --- Playback Controls ---

    const togglePlayPause = () => {
        if (!playerRef.current) return;
        if (isPlaying) playerRef.current.pauseVideo();
        else playerRef.current.playVideo();
    };

    const handleSeek = (seconds: number) => {
        if (!playerRef.current) return;
        const current = playerRef.current.getCurrentTime();
        playerRef.current.seekTo(current + seconds, true);
    };

    const playNext = () => {
        if (currentIndex < queue.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const playPrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseInt(e.target.value);
        setVolume(newVolume);
        if (playerRef.current) {
            playerRef.current.setVolume(newVolume);
        }
    };

    const toggleMute = () => {
        if (!playerRef.current) return;
        if (isMuted) { 
            playerRef.current.unMute(); 
            setIsMuted(false); 
        } else { 
            playerRef.current.mute(); 
            setIsMuted(true); 
        }
    };

    // play a song from history by index
    const playHistoryItem = (index: number) => {
        const itemToPlay = history[index];
        if (!itemToPlay) return;
        // move item to end of history
        const newHistory = [...history];
        newHistory.splice(index, 1);
        newHistory.push(itemToPlay);
        setHistory(newHistory);
        setQueue([...newHistory].reverse());
        setCurrentIndex(0);
        setShowHome(false);
        setHasStarted(true);
    };

    const handleGoHome = () => {
        if (currentVideoId) setShowHome(true);
        else { 
            setCurrentIndex(-1); 
            setIsPlaying(false); 
            setQueue(history); 
        }
    };

    const onToggleLoop = () => setIsLooping(!isLooping);

    // --- Progress Tracker ---
    // runs every 500ms to update progress bar
    useEffect(() => {
        const interval = setInterval(() => {
            if (playerRef.current) {
                const current = playerRef.current.getCurrentTime?.();
                const dur = playerRef.current.getDuration?.();
                if (dur > 0) {
                    setProgress((current / dur) * 100);
                    setDuration(dur);
                    setCurrentTime(current);
                    const state = playerRef.current.getPlayerState?.();
                    setIsPaused(state !== 1 && state !== 3);
                }
            }
        }, 500);
        return () => clearInterval(interval);
    }, []);

    // --- Format Time Helper ---
    // converts seconds to mm:ss format
    const formatTime = (seconds: number) => {
        const m = Math.floor(Math.abs(seconds) / 60);
        const s = Math.floor(Math.abs(seconds) % 60);
        return `${seconds < 0 ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
    };

    // return everything so components can use it
    return {
        // state
        hasStarted, setHasStarted,
        showHome, setShowHome,
        videoUrl, setVideoUrl,
        isSearching, searchResults, setSearchResults, searchError,
        queue, history,
        currentVideoId, currentIndex,
        isPlaying, isPaused, isMuted,
        volume, progress, currentTime, duration,
        isLooping,
        // refs
        playerRef, inputRef, searchTimeoutRef,
        // actions
        handleConfirm,
        togglePlayPause,
        handleSeek,
        playNext, playPrev,
        handleVolumeChange, toggleMute,
        playHistoryItem,
        handleGoHome,
        playVideoFromUrl,
        handlePlayerReady,
        handleStateChange,
        onToggleLoop,
        formatTime,
    };
}