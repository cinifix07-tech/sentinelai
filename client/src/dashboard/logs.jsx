import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../api'
import { Icon, PremiumLoader } from '../ui'

const PAGE_SIZE = 5

export default function Logs() {
  const [activities, setActivities] = useState([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet('/dashboard')
      setActivities(Array.isArray(data.activities) ? data.activities : [])
      setPage(1)
    } catch (requestError) {
      setError(requestError.message || 'Unable to load account logs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadLogs() }, [loadLogs])

  const pageCount = Math.max(1, Math.ceil(activities.length / PAGE_SIZE))
  const visible = activities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return <>
    <div className="page-heading logs-heading">
      <div>
        <span className="eyebrow">ACCOUNT AUDIT TRAIL</span>
        <h1>Activity logs<span className="lime">.</span></h1>
        <p>A private history of sign-ins, profile changes, and security actions on your account.</p>
      </div>
      <button type="button" className="secondary refresh-button" onClick={loadLogs} disabled={loading}><Icon name="refresh" />{loading ? 'Refreshing' : 'Refresh logs'}</button>
    </div>

    {error ? <div className="error dashboard-error" role="alert">{error}</div> : null}

    <section className="logs-shell card neo">
      <div className="logs-shell-head">
        <div className="logs-title"><span className="logs-icon"><Icon name="list" size={19} /></span><div><h2>Security activity</h2><p>Every record is tied to your authenticated account.</p></div></div>
        <span className="pill">{activities.length} {activities.length === 1 ? 'RECORD' : 'RECORDS'}</span>
      </div>
      {loading ? <PremiumLoader label="Loading account logs" /> : visible.length ? <div className="logs-table" role="table" aria-label="Account activity logs">
        <div className="logs-table-head" role="row"><span>TIME</span><span>ACTIVITY</span><span>STATUS</span></div>
        {visible.map((activity, index) => <div className="logs-row" role="row" key={activity.attempt_id || activity.id || `${activity.created_at}-${index}`}>
          <time>{formatDate(activity.created_at || activity.attempt_time)}</time>
          <div><strong>{activity.reason || activity.result || 'Account activity recorded'}</strong><small>{activity.email || 'Authenticated user activity'}</small></div>
          <span className={`log-status ${String(activity.result || '').toLowerCase().includes('fail') ? 'failed' : ''}`}>{formatStatus(activity.result)}</span>
        </div>)}
      </div> : <div className="logs-empty"><Icon name="shield" size={30} /><strong>No account activity yet</strong><p>Your security events will appear here after you sign in or update your account.</p></div>}
      {!loading && activities.length > 0 && <div className="logs-pagination"><span>Showing <strong>{(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, activities.length)}</strong> of <strong>{activities.length}</strong></span><div><button type="button" className="secondary" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1} aria-label="Previous logs page"><Icon name="arrow" size={15} />Previous</button><span className="logs-page-number">{page} / {pageCount}</span><button type="button" className="primary" onClick={() => setPage(value => Math.min(pageCount, value + 1))} disabled={page === pageCount} aria-label="Next logs page">Next<Icon name="arrow" size={15} /></button></div></div>}
    </section>
  </>
}

function formatDate(value) {
  if (!value) return 'Unknown time'
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatStatus(value) {
  return String(value || 'RECORDED').replaceAll('_', ' ').toUpperCase()
}
