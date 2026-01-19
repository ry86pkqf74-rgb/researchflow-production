/**
 * Community Forum List Component
 * Task 186: Community forum for research discussions
 */

import { useState, useEffect } from 'react';
import { MessageSquare, Users, ThumbsUp, Eye, Clock, Pin, Lock } from 'lucide-react';

interface ForumPost {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  category: string;
  tags: string[];
  isPinned: boolean;
  isLocked: boolean;
  viewCount: number;
  replyCount: number;
  likeCount: number;
  createdAt: string;
  lastActivityAt: string;
}

interface ForumCategory {
  id: string;
  name: string;
  description: string;
  postCount: number;
  icon: string;
}

const CATEGORIES: ForumCategory[] = [
  {
    id: 'general',
    name: 'General Discussion',
    description: 'General research discussions and questions',
    postCount: 0,
    icon: 'message',
  },
  {
    id: 'help',
    name: 'Help & Support',
    description: 'Get help with ResearchFlow features',
    postCount: 0,
    icon: 'help',
  },
  {
    id: 'showcase',
    name: 'Research Showcase',
    description: 'Share your research findings and projects',
    postCount: 0,
    icon: 'star',
  },
  {
    id: 'collaboration',
    name: 'Collaboration',
    description: 'Find collaborators for your research',
    postCount: 0,
    icon: 'users',
  },
  {
    id: 'announcements',
    name: 'Announcements',
    description: 'Official announcements and updates',
    postCount: 0,
    icon: 'megaphone',
  },
];

function PostCard({ post }: { post: ForumPost }) {
  return (
    <div
      className={`p-4 border-b hover:bg-muted/50 transition-colors ${
        post.isPinned ? 'bg-primary/5' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="hidden sm:block">
          {post.author.avatar ? (
            <img
              src={post.author.avatar}
              alt={post.author.name}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              {post.author.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {post.isPinned && (
              <Pin className="w-4 h-4 text-primary" />
            )}
            {post.isLocked && (
              <Lock className="w-4 h-4 text-muted-foreground" />
            )}
            <a
              href={`/community/posts/${post.id}`}
              className="font-semibold hover:text-primary truncate"
            >
              {post.title}
            </a>
          </div>

          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span>{post.author.name}</span>
            <span className="px-2 py-0.5 bg-muted rounded text-xs">
              {post.category}
            </span>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-1" title="Replies">
            <MessageSquare className="w-4 h-4" />
            {post.replyCount}
          </div>
          <div className="flex items-center gap-1" title="Views">
            <Eye className="w-4 h-4" />
            {post.viewCount}
          </div>
          <div className="flex items-center gap-1" title="Likes">
            <ThumbsUp className="w-4 h-4" />
            {post.likeCount}
          </div>
          <div className="flex items-center gap-1 text-xs" title="Last activity">
            <Clock className="w-3 h-3" />
            {new Date(post.lastActivityAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ category, onClick }: { category: ForumCategory; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left w-full"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded">
          <MessageSquare className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{category.name}</h3>
          <p className="text-sm text-muted-foreground">{category.description}</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          {category.postCount} posts
        </div>
      </div>
    </button>
  );
}

export function ForumList() {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [categories] = useState<ForumCategory[]>(CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'active'>('latest');

  useEffect(() => {
    async function fetchPosts() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCategory) params.set('category', selectedCategory);
        params.set('sort', sortBy);

        const response = await fetch(`/api/community/posts?${params}`);
        if (response.ok) {
          const data = await response.json();
          setPosts(data.posts);
        }
      } catch (error) {
        console.error('Failed to fetch posts:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, [selectedCategory, sortBy]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Community Forum</h1>
          <p className="text-muted-foreground">
            Discuss research, share findings, and connect with others
          </p>
        </div>
        <a
          href="/community/posts/new"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          New Post
        </a>
      </div>

      {!selectedCategory ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onClick={() => setSelectedCategory(category.id)}
            />
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-sm text-primary hover:underline"
              >
                All Categories
              </button>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">
                {categories.find((c) => c.id === selectedCategory)?.name}
              </span>
            </div>

            <div className="flex gap-2">
              {(['latest', 'popular', 'active'] as const).map((sort) => (
                <button
                  key={sort}
                  onClick={() => setSortBy(sort)}
                  className={`px-3 py-1 rounded text-sm capitalize ${
                    sortBy === sort
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {sort}
                </button>
              ))}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading posts...
              </div>
            ) : posts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No posts in this category yet.</p>
                <a
                  href="/community/posts/new"
                  className="text-primary hover:underline mt-2 inline-block"
                >
                  Be the first to post!
                </a>
              </div>
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}

export { PostCard, CategoryCard };
export type { ForumPost, ForumCategory };
