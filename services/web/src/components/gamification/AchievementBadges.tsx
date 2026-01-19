/**
 * Achievement Badges Component
 * Task 170: Gamification (badges, research streaks)
 */

import { useState, useEffect } from 'react';
import { Trophy, Star, Flame, Target, Zap, Award, Crown, Medal } from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'research' | 'collaboration' | 'milestone' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: string;
  progress?: number;
  maxProgress?: number;
}

interface UserStats {
  totalResearch: number;
  completedResearch: number;
  currentStreak: number;
  longestStreak: number;
  totalCollaborations: number;
  articlesPublished: number;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  trophy: <Trophy className="w-6 h-6" />,
  star: <Star className="w-6 h-6" />,
  flame: <Flame className="w-6 h-6" />,
  target: <Target className="w-6 h-6" />,
  zap: <Zap className="w-6 h-6" />,
  award: <Award className="w-6 h-6" />,
  crown: <Crown className="w-6 h-6" />,
  medal: <Medal className="w-6 h-6" />,
};

const RARITY_COLORS = {
  common: 'bg-gray-100 border-gray-300 text-gray-700',
  rare: 'bg-blue-100 border-blue-400 text-blue-700',
  epic: 'bg-purple-100 border-purple-400 text-purple-700',
  legendary: 'bg-yellow-100 border-yellow-400 text-yellow-700',
};

const RARITY_GLOW = {
  common: '',
  rare: 'shadow-blue-200',
  epic: 'shadow-purple-200',
  legendary: 'shadow-yellow-200 animate-pulse',
};

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const isUnlocked = !!achievement.unlockedAt;
  const hasProgress = achievement.progress !== undefined && achievement.maxProgress !== undefined;
  const progressPercent = hasProgress
    ? Math.round((achievement.progress! / achievement.maxProgress!) * 100)
    : 0;

  return (
    <div
      className={`relative p-4 rounded-lg border-2 transition-all ${
        isUnlocked
          ? `${RARITY_COLORS[achievement.rarity]} shadow-lg ${RARITY_GLOW[achievement.rarity]}`
          : 'bg-muted border-muted-foreground/20 opacity-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-full ${
            isUnlocked ? 'bg-white/50' : 'bg-muted-foreground/10'
          }`}
        >
          {ICON_MAP[achievement.icon] || <Award className="w-6 h-6" />}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold">{achievement.name}</h4>
          <p className="text-sm opacity-75">{achievement.description}</p>

          {hasProgress && !isUnlocked && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span>Progress</span>
                <span>
                  {achievement.progress} / {achievement.maxProgress}
                </span>
              </div>
              <div className="h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {isUnlocked && (
            <p className="text-xs mt-2 opacity-60">
              Unlocked {new Date(achievement.unlockedAt!).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {isUnlocked && (
        <div className="absolute top-2 right-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full capitalize ${
              RARITY_COLORS[achievement.rarity]
            }`}
          >
            {achievement.rarity}
          </span>
        </div>
      )}
    </div>
  );
}

function StreakDisplay({ currentStreak, longestStreak }: { currentStreak: number; longestStreak: number }) {
  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-full">
          <Flame className="w-8 h-8" />
        </div>
        <div>
          <p className="text-sm opacity-90">Current Streak</p>
          <p className="text-3xl font-bold">{currentStreak} days</p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/20">
        <p className="text-sm opacity-75">
          Longest streak: {longestStreak} days
        </p>
      </div>
    </div>
  );
}

export function AchievementPanel({ userId }: { userId: string }) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        const [achievementsRes, statsRes] = await Promise.all([
          fetch(`/api/users/${userId}/achievements`),
          fetch(`/api/users/${userId}/stats`),
        ]);

        if (achievementsRes.ok) {
          const data = await achievementsRes.json();
          setAchievements(data.achievements);
        }

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch achievements:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId]);

  const filteredAchievements = achievements.filter((a) => {
    if (filter === 'unlocked') return !!a.unlockedAt;
    if (filter === 'locked') return !a.unlockedAt;
    return true;
  });

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Achievements</h2>
          <p className="text-muted-foreground">
            {unlockedCount} of {achievements.length} unlocked
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'unlocked', 'locked'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm capitalize ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StreakDisplay
            currentStreak={stats.currentStreak}
            longestStreak={stats.longestStreak}
          />
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Research Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-2xl font-bold">{stats.totalResearch}</p>
                <p className="text-sm text-muted-foreground">Total Research</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completedResearch}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalCollaborations}</p>
                <p className="text-sm text-muted-foreground">Collaborations</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.articlesPublished}</p>
                <p className="text-sm text-muted-foreground">Published</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map((achievement) => (
          <AchievementBadge key={achievement.id} achievement={achievement} />
        ))}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No achievements found for this filter.
        </div>
      )}
    </div>
  );
}

export { AchievementBadge, StreakDisplay };
export type { Achievement, UserStats };
