/**
 * Seed Atlanta Mock Case (Task 100)
 *
 * Seeds the database with the Atlanta Medical Research Institute
 * mock case for system testing and demonstration purposes.
 *
 * Usage:
 *   npx ts-node scripts/seed-atlanta-case.ts
 *   npm run db:seed:atlanta
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

// Import schema tables
import {
  organizations,
  orgMemberships,
  users,
  researchProjects,
  artifacts,
  reviewSessions,
} from '../packages/core/types/schema';

// Load fixture data
const fixturePath = path.resolve(__dirname, '../tests/fixtures/atlanta-surgical-case.json');
const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

// Database connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/researchflow';

async function seedAtlantaCase() {
  console.log('🏥 Seeding Atlanta Medical Research Institute mock case...\n');

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Check if already seeded
    const existingOrg = await db
      .select()
      .from(organizations)
      .where((org: any) => org.slug.eq(fixtureData.organization.slug))
      .limit(1);

    if (existingOrg.length > 0) {
      console.log('⚠️  Atlanta case already exists. Skipping seed.');
      console.log('   To re-seed, delete the organization first.');
      await pool.end();
      return;
    }

    // Generate IDs
    const orgId = uuidv4();
    const projectId = uuidv4();
    const manuscriptId = uuidv4();
    const userIds: Record<string, string> = {};

    // 1. Create Organization
    console.log('📁 Creating organization...');
    await db.insert(organizations).values({
      id: orgId,
      name: fixtureData.organization.name,
      slug: fixtureData.organization.slug,
      description: fixtureData.organization.description,
      settings: fixtureData.organization.settings,
      subscriptionTier: fixtureData.organization.subscriptionTier,
      isActive: true,
    });
    console.log(`   ✓ Created: ${fixtureData.organization.name}`);

    // 2. Create Users and Memberships
    console.log('\n👥 Creating users and memberships...');
    for (const userData of fixtureData.users) {
      const userId = uuidv4();
      userIds[userData.id] = userId;

      // Create user (simplified - in production would use auth system)
      await db.insert(users).values({
        id: userId,
        username: userData.email.split('@')[0],
        email: userData.email,
      });

      // Create org membership
      await db.insert(orgMemberships).values({
        id: uuidv4(),
        orgId,
        userId,
        orgRole: userData.orgRole,
      });

      console.log(`   ✓ ${userData.displayName} (${userData.orgRole})`);
    }

    // 3. Create Research Project
    console.log('\n📊 Creating research project...');
    const projectData = fixtureData.project;
    await db.insert(researchProjects).values({
      id: projectId,
      orgId,
      title: projectData.title,
      description: projectData.description,
      status: projectData.status,
      createdBy: userIds['user_lead'],
      metadata: {
        researchType: projectData.researchType,
        hypothesis: projectData.hypothesis,
        primaryEndpoint: projectData.primaryEndpoint,
        secondaryEndpoints: projectData.secondaryEndpoints,
        enrollmentTarget: projectData.enrollmentTarget,
        expectedCompletionDate: projectData.expectedCompletionDate,
        irbNumber: projectData.irbNumber,
      },
    });
    console.log(`   ✓ ${projectData.title}`);

    // 4. Create Artifacts
    console.log('\n📄 Creating artifacts...');
    for (const artifactData of fixtureData.artifacts) {
      await db.insert(artifacts).values({
        id: uuidv4(),
        researchId: projectId,
        filename: artifactData.filename,
        artifactType: artifactData.artifactType,
        mimeType: artifactData.mimeType,
        size: artifactData.size,
        description: artifactData.description,
        metadata: artifactData.metadata,
        uploadedBy: userIds['user_researcher'],
      });
      console.log(`   ✓ ${artifactData.filename} (${artifactData.artifactType})`);
    }

    // 5. Create Manuscript (as artifact type)
    console.log('\n📝 Creating manuscript...');
    const manuscriptData = fixtureData.manuscript;
    await db.insert(artifacts).values({
      id: manuscriptId,
      researchId: projectId,
      filename: `${manuscriptData.title.substring(0, 50)}.docx`,
      artifactType: 'manuscript',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 102400,
      description: manuscriptData.title,
      metadata: {
        status: manuscriptData.status,
        sections: manuscriptData.sections,
        targetJournal: manuscriptData.targetJournal,
        keywords: manuscriptData.keywords,
      },
      uploadedBy: userIds['user_lead'],
    });
    console.log(`   ✓ ${manuscriptData.title.substring(0, 60)}...`);

    // 6. Create Review Sessions
    console.log('\n📅 Creating review sessions...');
    for (const sessionData of fixtureData.reviewSessions) {
      await db.insert(reviewSessions).values({
        id: uuidv4(),
        orgId,
        researchId: projectId,
        topic: sessionData.topic,
        startTime: new Date(sessionData.startTime),
        status: sessionData.status,
        participants: sessionData.participants,
        notes: sessionData.notes,
      });
      console.log(`   ✓ ${sessionData.topic} (${sessionData.status})`);
    }

    console.log('\n✅ Atlanta mock case seeded successfully!\n');
    console.log('Summary:');
    console.log(`   Organization: ${fixtureData.organization.name}`);
    console.log(`   Users: ${fixtureData.users.length}`);
    console.log(`   Research Project: 1`);
    console.log(`   Artifacts: ${fixtureData.artifacts.length}`);
    console.log(`   Manuscript: 1`);
    console.log(`   Review Sessions: ${fixtureData.reviewSessions.length}`);
    console.log('\nOrg Slug: ' + fixtureData.organization.slug);
    console.log('Test Login: dr.chen@amri.edu');

  } catch (error) {
    console.error('❌ Error seeding Atlanta case:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seedAtlantaCase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedAtlantaCase };
