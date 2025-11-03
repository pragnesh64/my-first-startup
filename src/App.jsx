import React, { useEffect, useState } from 'react'

const REPO_OWNER = 'pragnesh64'
const REPO_NAME = 'my-first-startup'
// Fixed start date - all users see the same timer from this date
// Set once to "now" so refresh won't reset; change if you need a new start
const GLOBAL_START_DATE = 1762194514910

function formatHMS(totalMs) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

function useGlobalCounter() {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const elapsedMs = Math.max(0, now - GLOBAL_START_DATE)
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

export default function App() {
  const { days, elapsedMs } = useGlobalCounter()
  const [totalCommits, setTotalCommits] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchTotalCommits(REPO_OWNER, REPO_NAME)
      .then((count) => { if (!cancelled) setTotalCommits(typeof count === 'number' ? count : 0) })
      .catch(() => { if (!cancelled) setTotalCommits(0) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="page">
      <header className="header">
        <div className="brand">My First Startup</div>
      </header>

      <main className="main">
        <div className="days">
          <span className="days-number">{days}</span>
          <span className="days-label">days</span>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-left">
          <span className="timer" aria-label="elapsed time in hours minutes and seconds">{formatHMS(elapsedMs)}</span>
        </div>
        <div className="footer-right">
          <span className="commits">Commits: {totalCommits == null ? '…' : totalCommits}</span>
        </div>
      </footer>
    </div>
  )
}


