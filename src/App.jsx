import React, { useEffect, useState } from 'react'

const REPO_OWNER = 'pragnesh64'
const REPO_NAME = 'my-first-startup'
// Counts since last commit on the repo's default branch

function formatHMS(totalMs) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

function formatDate(ms) {
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function useElapsedSince(startMs) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  const elapsedMs = startMs == null ? 0 : Math.max(0, now - startMs)
  const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24))
  return { days, elapsedMs }
}

async function fetchTotalCommits(owner, repo) {
  try {
    // Try to get total commits using contributors endpoint (sum of contributions)
    const url = `https://api.github.com/repos/${owner}/${repo}/contributors?anon=1&per_page=100`
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json'
      }
    })
    
    // If repo not found or empty, return 0
    if (response.status === 404) return 0
    
    if (!response.ok) {
      // For other errors, try alternative method or return 0
      console.warn('Contributors API failed, trying commits API')
      return await fetchCommitsCount(owner, repo)
    }
    
    const data = await response.json()
    if (!Array.isArray(data) || data.length === 0) return 0
    
    const total = data.reduce((sum, c) => sum + (typeof c.contributions === 'number' ? c.contributions : 0), 0)
    return total > 0 ? total : 0
  } catch (err) {
    // Fallback: try to count commits directly
    console.warn('Error fetching commits:', err)
    return await fetchCommitsCount(owner, repo)
  }
}

async function fetchCommitsCount(owner, repo) {
  try {
    // Alternative: check if repo exists and has commits
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json'
      }
    })
    
    if (response.status === 404) return 0
    if (!response.ok) return 0
    
    const data = await response.json()
    // If we get data, repo exists and has commits, but exact count requires different API
    // Return 1+ as minimum indicator (contributors method should work for accurate count)
    return Array.isArray(data) && data.length > 0 ? 1 : 0
  } catch {
    return 0
  }
}

async function fetchLastCommitMs(owner, repo) {
  try {
    // First try the lightweight repo API for last push timestamp
    const repoUrl = `https://api.github.com/repos/${owner}/${repo}`
    const repoRes = await fetch(repoUrl, { headers: { 'Accept': 'application/vnd.github+json' } })
    if (repoRes.status === 404) return null
    if (repoRes.ok) {
      const repoJson = await repoRes.json()
      if (repoJson && repoJson.pushed_at) {
        const ms = Date.parse(repoJson.pushed_at)
        if (!Number.isNaN(ms)) return ms
      }
    }
  } catch {}

  try {
    // Fallback: fetch latest commit from default branch
    const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`
    const res = await fetch(commitsUrl, { headers: { 'Accept': 'application/vnd.github+json' } })
    if (!res.ok) return null
    const arr = await res.json()
    if (Array.isArray(arr) && arr.length > 0) {
      const iso = arr[0]?.commit?.author?.date || arr[0]?.commit?.committer?.date
      const ms = iso ? Date.parse(iso) : NaN
      return Number.isNaN(ms) ? null : ms
    }
    return null
  } catch {
    return null
  }
}

export default function App() {
  const [lastCommitMs, setLastCommitMs] = useState(null)
  const [isLoadingCommitTime, setIsLoadingCommitTime] = useState(true)
  const { days, elapsedMs } = useElapsedSince(lastCommitMs)
  const [totalCommits, setTotalCommits] = useState(null)
  const [isLoadingCommits, setIsLoadingCommits] = useState(true)
  const [minDelayPassed, setMinDelayPassed] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchTotalCommits(REPO_OWNER, REPO_NAME)
      .then((count) => { if (!cancelled) setTotalCommits(typeof count === 'number' ? count : 0) })
      .catch(() => { if (!cancelled) setTotalCommits(0) })
      .finally(() => { if (!cancelled) setIsLoadingCommits(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchLastCommitMs(REPO_OWNER, REPO_NAME)
      .then((ms) => { if (!cancelled) setLastCommitMs(ms) })
      .catch(() => { if (!cancelled) setLastCommitMs(null) })
      .finally(() => { if (!cancelled) setIsLoadingCommitTime(false) })
    return () => { cancelled = true }
  }, [])

  // Ensure splash shows for at least 3 seconds and advance determinate progress
  useEffect(() => {
    const minDurationMs = 3000
    const startedAt = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt
      const base = Math.min(95, Math.floor((elapsed / minDurationMs) * 95))
      setProgress((p) => Math.max(p, base))
      if (elapsed >= minDurationMs) {
        setMinDelayPassed(true)
      }
    }, 50)
    return () => clearInterval(tick)
  }, [])

  const dataLoading = (isLoadingCommitTime || isLoadingCommits)
  const isLoading = dataLoading || !minDelayPassed

  useEffect(() => {
    if (!dataLoading && minDelayPassed) {
      setProgress(100)
    }
  }, [dataLoading, minDelayPassed])

  if (isLoading) {
    return (
      <div className="splash">
        <div className="splash-card">
          <div className="splash-title">👋 Hello Founder,</div>
          <div className="splash-sub">building something great...</div>
          <div className="progress" role="progressbar" aria-label="loading" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="brand">My First Startup</div>
          <div className="brand-subtitle">Productivity Log</div>
        </div>
        <a
          className="gh-link"
          href="https://github.com/pragnesh64"
          target="_blank"
          rel="noreferrer"
          aria-label="Open GitHub profile"
          title="View activity on GitHub"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill="#000" d="M12 .5a11.5 11.5 0 0 0-3.64 22.42c.58.1.79-.25.79-.56v-2.03c-3.22.7-3.9-1.4-3.9-1.4-.53-1.35-1.3-1.71-1.3-1.71-1.06-.73.08-.72.08-.72 1.18.08 1.8 1.22 1.8 1.22 1.04 1.78 2.73 1.27 3.4.97.1-.76.41-1.27.75-1.56-2.57-.29-5.27-1.28-5.27-5.7 0-1.26.45-2.28 1.2-3.09-.12-.29-.52-1.46.11-3.04 0 0 .98-.31 3.2 1.18a11.1 11.1 0 0 1 5.82 0c2.22-1.49 3.2-1.18 3.2-1.18.63 1.58.23 2.75.11 3.04.75.81 1.2 1.83 1.2 3.09 0 4.43-2.71 5.4-5.29 5.68.42.36.8 1.07.8 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"/>
          </svg>
        </a>
      </header>

      <main className="main">
        <div className="stats-card">
          <div className="stat-primary">
            <span className={`stat-number ${lastCommitMs != null ? 'tick-anim' : ''}`}>{lastCommitMs == null ? '–' : days}</span>
            <span className={`stat-unit ${lastCommitMs != null ? 'tick-anim' : ''}`}>days</span>
          </div>
          <div className="stat-details">
            <p className="stat-description">since last commit</p>
            {lastCommitMs != null && (
              <p className="stat-date">{formatDate(lastCommitMs)}</p>
            )}
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-left">
          <span className="timer">
            <span className="timer-dot" aria-hidden="true"></span>
            <span aria-label="elapsed time in hours minutes and seconds">{lastCommitMs == null ? '…' : `${formatHMS(elapsedMs)} since last commit`}</span>
          </span>
        </div>
        <div className="footer-right">
          <span className="commits">Commits: {totalCommits == null ? '…' : totalCommits}</span>
        </div>
      </footer>
    </div>
  )
}


