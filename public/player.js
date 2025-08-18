// === Custom Video Player Logic (player.js) ===
class CustomPlayer {
    constructor(videoElement, syncCallbacks) {
        this.video = videoElement;
        this.syncCallbacks = syncCallbacks; // { onPlay, onPause, onSeek }

        this.container = videoElement.parentElement;
        this.controls = this.container.querySelector('.player-controls');
        this.playPauseBtn = this.container.querySelector('.play-pause-btn');
        this.volumeBtn = this.container.querySelector('.volume-btn');
        this.volumeSlider = this.container.querySelector('.volume-slider');
        this.volumeProgress = this.container.querySelector('.volume-progress');
        this.timelineContainer = this.container.querySelector('.timeline-container');
        this.timelineProgress = this.container.querySelector('.timeline .progress');
        this.thumbIndicator = this.container.querySelector('.thumb-indicator');
        this.currentTimeEl = this.container.querySelector('.current-time');
        this.totalTimeEl = this.container.querySelector('.total-time');
        this.fullscreenBtn = this.container.querySelector('.fullscreen-btn');

        this.isScrubbing = false;
        this.wasPaused = true;

        this.initEvents();
    }

    // Initialize all event listeners
    initEvents() {
        this.playPauseBtn.addEventListener('click', this.togglePlay.bind(this));
        this.video.addEventListener('play', this.updatePlayPauseIcon.bind(this));
        this.video.addEventListener('pause', this.updatePlayPauseIcon.bind(this));
        this.video.addEventListener('timeupdate', this.updateTimeline.bind(this));
        this.video.addEventListener('loadeddata', this.setInitialData.bind(this));
        this.video.addEventListener('volumechange', this.updateVolume.bind(this));

        this.volumeBtn.addEventListener('click', this.toggleMute.bind(this));
        this.volumeSlider.addEventListener('click', this.handleVolumeScrub.bind(this));

        this.timelineContainer.addEventListener('mousedown', this.startScrubbing.bind(this));
        document.addEventListener('mouseup', this.stopScrubbing.bind(this));
        document.addEventListener('mousemove', this.handleTimelineScrub.bind(this));
        
        this.fullscreenBtn.addEventListener('click', this.toggleFullScreen.bind(this));
    }

    // --- Play/Pause ---
    togglePlay() {
        this.video.paused ? this.video.play() : this.video.pause();
    }

    updatePlayPauseIcon() {
        const icon = this.playPauseBtn.querySelector('i');
        icon.classList.toggle('fa-play', this.video.paused);
        icon.classList.toggle('fa-pause', !this.video.paused);
        
        this.container.classList.toggle('paused', this.video.paused);

        // Sync with server
        if (this.video.paused) {
            this.syncCallbacks.onPause(this.video.currentTime);
        } else {
            this.syncCallbacks.onPlay(this.video.currentTime);
        }
    }
    
    // --- Timeline / Seek ---
    updateTimeline() {
        const percent = (this.video.currentTime / this.video.duration) * 100;
        this.timelineProgress.style.width = `${percent}%`;
        this.thumbIndicator.style.left = `${percent}%`;
        this.currentTimeEl.textContent = this.formatDuration(this.video.currentTime);
    }
    
    startScrubbing(e) {
        this.isScrubbing = true;
        this.wasPaused = this.video.paused;
        if (!this.wasPaused) this.video.pause();
        this.handleTimelineScrub(e);
    }

    stopScrubbing() {
        if (!this.isScrubbing) return;
        this.isScrubbing = false;
        if (!this.wasPaused) this.video.play();
        // Sync with server
        this.syncCallbacks.onSeek(this.video.currentTime);
    }

    handleTimelineScrub(e) {
        if (!this.isScrubbing) return;
        const rect = this.timelineContainer.getBoundingClientRect();
        const percent = Math.min(Math.max(0, e.clientX - rect.x), rect.width) / rect.width;
        this.video.currentTime = percent * this.video.duration;
    }

    // --- Volume ---
    toggleMute() {
        this.video.muted = !this.video.muted;
    }

    updateVolume() {
        this.volumeProgress.style.width = this.video.muted ? '0' : `${this.video.volume * 100}%`;
        const icon = this.volumeBtn.querySelector('i');
        icon.classList.toggle('fa-volume-high', !this.video.muted && this.video.volume > 0.5);
        icon.classList.toggle('fa-volume-low', !this.video.muted && this.video.volume <= 0.5 && this.video.volume > 0);
        icon.classList.toggle('fa-volume-xmark', this.video.muted || this.video.volume === 0);
    }
    
    handleVolumeScrub(e) {
        const rect = this.volumeSlider.getBoundingClientRect();
        const percent = Math.min(Math.max(0, e.clientX - rect.x), rect.width) / rect.width;
        this.video.volume = percent;
        this.video.muted = percent === 0;
    }

    // --- Fullscreen ---
    toggleFullScreen() {
        if (document.fullscreenElement == null) {
            this.container.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    // --- Utility ---
    setInitialData() {
        this.totalTimeEl.textContent = this.formatDuration(this.video.duration);
        this.updateTimeline();
        this.updateVolume();
    }

    formatDuration(time) {
        const seconds = Math.floor(time % 60);
        const minutes = Math.floor(time / 60) % 60;
        const hours = Math.floor(time / 3600);
        if (hours === 0) {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // --- External Control for Syncing ---
    syncState(state) {
        this.video.currentTime = state.currentTime;
        state.paused ? this.video.pause() : this.video.play();
    }
}