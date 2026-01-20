/**
 * User Profile Page
 * Task 190: User profile customization (specialty tags, etc.)
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Calendar, Tag, Save, Award, Settings } from 'lucide-react';
import { AchievementPanel } from '@/components/gamification/AchievementBadges';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  specialtyTags: string[];
  preferences: {
    emailNotifications: boolean;
    inAppNotifications: boolean;
    digestFrequency: 'daily' | 'weekly' | 'none';
  };
}

const SPECIALTY_OPTIONS = [
  'Clinical Research',
  'Epidemiology',
  'Biostatistics',
  'Health Informatics',
  'Public Health',
  'Medical Writing',
  'Data Science',
  'Systematic Reviews',
  'Meta-Analysis',
  'Oncology',
  'Cardiology',
  'Neurology',
  'Pediatrics',
  'Surgery',
];

export default function ProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'achievements' | 'preferences'>('profile');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch('/api/users/me/profile');
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    try {
      const response = await fetch('/api/users/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialtyTags: profile.specialtyTags,
          preferences: profile.preferences,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save profile');
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleSpecialty = (specialty: string) => {
    if (!profile) return;
    const tags = profile.specialtyTags.includes(specialty)
      ? profile.specialtyTags.filter((t) => t !== specialty)
      : [...profile.specialtyTags, specialty];
    setProfile({ ...profile, specialtyTags: tags });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 text-center">
        <p>Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Your Profile</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">
        {(['profile', 'achievements', 'preferences'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-md text-sm capitalize transition-colors ${
              activeTab === tab
                ? 'bg-background shadow'
                : 'hover:bg-background/50'
            }`}
          >
            {tab === 'profile' && <User className="w-4 h-4 inline mr-2" />}
            {tab === 'achievements' && <Award className="w-4 h-4 inline mr-2" />}
            {tab === 'preferences' && <Settings className="w-4 h-4 inline mr-2" />}
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{profile.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{profile.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-medium">{new Date(profile.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Specialty Tags */}
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Specialty Tags
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select your areas of expertise to personalize your experience
            </p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((specialty) => (
                <button
                  key={specialty}
                  onClick={() => toggleSpecialty(specialty)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    profile.specialtyTags.includes(specialty)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {specialty}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'achievements' && (
        <AchievementPanel userId={profile.id} />
      )}

      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Notification Preferences</h2>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span>Email Notifications</span>
                <input
                  type="checkbox"
                  checked={profile.preferences.emailNotifications}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      preferences: { ...profile.preferences, emailNotifications: e.target.checked },
                    })
                  }
                  className="w-5 h-5"
                />
              </label>
              <label className="flex items-center justify-between">
                <span>In-App Notifications</span>
                <input
                  type="checkbox"
                  checked={profile.preferences.inAppNotifications}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      preferences: { ...profile.preferences, inAppNotifications: e.target.checked },
                    })
                  }
                  className="w-5 h-5"
                />
              </label>
              <div className="flex items-center justify-between">
                <span>Digest Frequency</span>
                <select
                  value={profile.preferences.digestFrequency}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      preferences: {
                        ...profile.preferences,
                        digestFrequency: e.target.value as 'daily' | 'weekly' | 'none',
                      },
                    })
                  }
                  className="px-3 py-1 border rounded-md bg-background"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
