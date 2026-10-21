import { useState, useEffect } from 'react'
import { collection, addDoc, onSnapshot, updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp, query, orderBy, increment } from 'firebase/firestore'
import { db, firebaseProjectId, isFirebaseConfigured } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ThumbsUp, MessageSquare, Plus, Search } from 'lucide-react'

const CATEGORIES = ['all', 'crop-tips', 'disease-help', 'market', 'equipment', 'schemes']
const CATEGORY_LABELS = { 'all': 'All', 'crop-tips': 'Crop Tips', 'disease-help': 'Disease Help', 'market': 'Market Talk', 'equipment': 'Equipment', 'schemes': 'Govt Schemes' }
const CATEGORY_COLORS = { 'crop-tips': 'bg-green-100 text-green-700', 'disease-help': 'bg-red-100 text-red-700', 'market': 'bg-orange-100 text-orange-700', 'equipment': 'bg-blue-100 text-blue-700', 'schemes': 'bg-purple-100 text-purple-700' }

function timeAgo(ts) {
  const seconds = typeof ts?.seconds === 'number'
    ? ts.seconds
    : typeof ts?.toDate === 'function'
      ? Math.floor(ts.toDate().getTime() / 1000)
      : typeof ts === 'string' || ts instanceof Date
        ? Math.floor(new Date(ts).getTime() / 1000)
        : null
  if (!seconds || !Number.isFinite(seconds)) return ''
  const diff = Math.floor((Date.now() / 1000) - seconds)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function PostCard({ post, onUpvote, onSelect }) {
  const { user } = useAuth()
  const hasUpvoted = post.upvotedBy?.includes(user?.uid)

  return (
    <Card className="rounded-xl shadow-sm border border-gray-100 hover:border-gray-200 transition-all cursor-pointer" onClick={() => onSelect(post)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-[#111827] text-sm leading-snug">{post.title}</h3>
          <Badge className={`text-xs shrink-0 ${CATEGORY_COLORS[post.category] || 'bg-gray-100 text-gray-600'}`}>
            {CATEGORY_LABELS[post.category] || post.category}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{post.body}</p>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{post.authorName} · {timeAgo(post.createdAt)}</span>
          <div className="flex items-center gap-3">
            <button onClick={e => { e.stopPropagation(); onUpvote(post) }}
              className={`flex items-center gap-1 transition-colors ${hasUpvoted ? 'text-[#2D6A4F] font-semibold' : 'hover:text-[#2D6A4F]'}`}>
              <ThumbsUp className="w-3.5 h-3.5" /> {post.upvotes || 0}
            </button>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> {post.commentCount || 0}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PostDetail({ post, onClose }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!post) return
    const q = query(collection(db, 'posts', post.id, 'comments'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [post])

  const submitComment = async () => {
    if (!comment.trim() || !user) return
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        body: comment,
        authorId: user.uid,
        authorName: user.displayName || user.email || 'Farmer',
        createdAt: serverTimestamp(),
      })
      await updateDoc(doc(db, 'posts', post.id), { commentCount: increment(1) })
      setComment('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="font-bold text-[#1B4332] text-lg">{post.title}</h2>
          <Badge className={`text-xs shrink-0 ${CATEGORY_COLORS[post.category] || 'bg-gray-100 text-gray-600'}`}>
            {CATEGORY_LABELS[post.category]}
          </Badge>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">{post.body}</p>
        <p className="text-xs text-gray-400 mt-2">{post.authorName} · {timeAgo(post.createdAt)}</p>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-semibold text-[#1B4332] mb-3">Comments ({comments.length})</p>
        <div className="flex flex-col gap-3 max-h-48 overflow-y-auto mb-3">
          {comments.length === 0 ? (
            <p className="text-sm text-gray-400">No comments yet. Be the first!</p>
          ) : comments.map(c => (
            <div key={c.id} className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-700">{c.body}</p>
              <p className="text-xs text-gray-400 mt-1">{c.authorName} · {timeAgo(c.createdAt)}</p>
            </div>
          ))}
        </div>
        {user ? (
          <div className="flex gap-2">
            <Textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Write a comment..." className="text-sm resize-none h-16" />
            <Button onClick={submitComment} disabled={submitting || !comment.trim()}
              className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white shrink-0">
              Post
            </Button>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Login to comment</p>
        )}
      </div>
      <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">← Back to posts</button>
    </div>
  )
}

export default function Community() {
  const { user, loading: authLoading } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [firestoreError, setFirestoreError] = useState('')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [newPost, setNewPost] = useState({ title: '', body: '', category: 'crop-tips' })
  const [posting, setPosting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const isLoading = authLoading || (Boolean(user) && isFirebaseConfigured && loading)

  useEffect(() => {
    if (authLoading || !user?.uid || !isFirebaseConfigured || !db) return undefined
    // Read the whole collection and sort client-side so legacy posts without
    // createdAt are not silently excluded by Firestore's orderBy behavior.
    const q = query(collection(db, 'posts'))
    const unsub = onSnapshot(q, snap => {
      const documents = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      documents.sort((a, b) => getPostTime(b) - getPostTime(a))
      setPosts(documents)
      setLoading(false)
      setFirestoreError('')
    }, error => {
      console.error('Community Firestore subscription failed:', error.code, error.message)
      setFirestoreError(`Could not load posts (${error.code || 'unknown'}). Check that Firestore rules are published for ${firebaseProjectId} and that you are signed in.`)
      setLoading(false)
    })
    return unsub
  }, [authLoading, user?.uid])

  const pageError = !authLoading && !isFirebaseConfigured
    ? 'Firebase is not configured. Create frontend/.env from frontend/.env.example, then restart the frontend.'
    : !authLoading && !user
      ? 'Sign in to load community messages.'
      : firestoreError

  const handleUpvote = async (post) => {
    if (!user) return
    const hasUpvoted = post.upvotedBy?.includes(user.uid)
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        upvotes: (post.upvotes || 0) + (hasUpvoted ? -1 : 1),
        upvotedBy: hasUpvoted ? arrayRemove(user.uid) : arrayUnion(user.uid),
      })
    } catch (error) {
      setFirestoreError(error.code === 'permission-denied'
        ? 'Firestore denied this update. Check that the deployed rules match this app.'
        : 'Could not update the post. Check your connection and try again.')
    }
  }

  const submitPost = async () => {
    if (!newPost.title.trim() || !newPost.body.trim() || !user) return
    setPosting(true)
    try {
      await addDoc(collection(db, 'posts'), {
        ...newPost,
        authorId: user.uid,
        authorName: user.displayName || user.email || 'Farmer',
        upvotes: 0,
        upvotedBy: [],
        commentCount: 0,
        createdAt: serverTimestamp(),
      })
      setNewPost({ title: '', body: '', category: 'crop-tips' })
      setDialogOpen(false)
    } catch (error) {
      console.error('Community post write failed:', error.code, error.message)
      setFirestoreError(`Post was not saved (${error.code || 'unknown'}). Check Firestore rules for ${firebaseProjectId} and try again.`)
    } finally {
      setPosting(false)
    }
  }

  const filtered = posts.filter(p => {
    if (category !== 'all' && p.category !== category) return false
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.body.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
      <div className="mt-8 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1B4332]">Community Forum</h1>
          <p className="text-sm text-gray-500 mt-1">Discuss farming tips, prices, and more</p>
          {firebaseProjectId && <p className="text-xs text-gray-400 mt-1">Connected Firebase project: {firebaseProjectId}</p>}
        </div>
        {user && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white">
                <Plus className="w-4 h-4 mr-1" /> New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-[#1B4332]">Create Post</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 mt-2">
                <Input placeholder="Title" value={newPost.title} onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))} />
                <Textarea placeholder="What's on your mind?" value={newPost.body} onChange={e => setNewPost(p => ({ ...p, body: e.target.value }))} className="resize-none h-24" />
                <select value={newPost.category} onChange={e => setNewPost(p => ({ ...p, category: e.target.value }))}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-[#2D6A4F] focus:outline-none">
                  {CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
                <Button onClick={submitPost} disabled={posting || !newPost.title.trim() || !newPost.body.trim()}
                  className="bg-[#2D6A4F] hover:bg-[#1B4332] text-white">
                  {posting ? 'Posting...' : 'Post'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {pageError && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
          {pageError}
        </div>
      )}

      {selected ? (
        <Card className="rounded-xl shadow-sm border border-gray-100">
          <CardContent className="p-5">
            <PostDetail post={selected} onClose={() => setSelected(null)} />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search + category filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search posts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${category === c ? 'bg-[#2D6A4F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
            ) : filtered.length === 0 ? (
              <Card className="rounded-xl shadow-sm border border-gray-100">
                <CardContent className="p-8 text-center text-gray-400 text-sm">
                  No posts yet. {user ? 'Be the first to post!' : 'Login to create a post.'}
                </CardContent>
              </Card>
            ) : (
              filtered.map(p => <PostCard key={p.id} post={p} onUpvote={handleUpvote} onSelect={setSelected} />)
            )}
          </div>
        </>
      )}
    </div>
  )
}

function getPostTime(post) {
  const timestamp = post.createdAt || post.timestamp || post.date
  if (typeof timestamp?.seconds === 'number') return timestamp.seconds
  if (typeof timestamp?.toDate === 'function') return timestamp.toDate().getTime() / 1000
  const parsed = timestamp ? new Date(timestamp).getTime() / 1000 : 0
  return Number.isFinite(parsed) ? parsed : 0
}
