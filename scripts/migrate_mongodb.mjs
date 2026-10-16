import { MongoClient } from "mongodb";

const SOURCE_URI = "mongodb+srv://deluzexdata_db_user:h1NcEh52LTJtZ3cE@deluzex.eszrr2w.mongodb.net/?retryWrites=true&w=majority";
const TARGET_URI = "mongodb+srv://aabidalideluzexlighting_db_user:ed6sMrhwo2mgbJOl@cluster0.wpeeulp.mongodb.net/?retryWrites=true&w=majority";

async function migrate() {
  console.log("Connecting to Source MongoDB...");
  const sourceClient = new MongoClient(SOURCE_URI, { connectTimeoutMS: 15000, serverSelectionTimeoutMS: 15000 });
  await sourceClient.connect();
  console.log("Connected to Source MongoDB successfully!");

  console.log("Connecting to Target MongoDB...");
  const targetClient = new MongoClient(TARGET_URI, { connectTimeoutMS: 15000, serverSelectionTimeoutMS: 15000 });
  await targetClient.connect();
  console.log("Connected to Target MongoDB successfully!");

  try {
    const adminDb = sourceClient.db().admin();
    const dbsList = await adminDb.listDatabases();
    
    // Filter out internal databases
    const userDbs = dbsList.databases.filter(d => !["admin", "local", "config"].includes(d.name));
    console.log(`\nFound ${userDbs.length} database(s) to migrate:`, userDbs.map(d => `${d.name} (${d.sizeOnDisk} bytes)`));

    const migrationSummary = [];

    for (const dbInfo of userDbs) {
      const dbName = dbInfo.name;
      console.log(`\n========================================`);
      console.log(`Processing Database: [${dbName}]`);
      console.log(`========================================`);

      const sourceDb = sourceClient.db(dbName);
      const targetDb = targetClient.db(dbName);

      const collections = await sourceDb.listCollections().toArray();
      console.log(`Found ${collections.length} collection(s) in [${dbName}]`);

      for (const collInfo of collections) {
        const collName = collInfo.name;
        if (collName.startsWith("system.")) continue;

        const sourceColl = sourceDb.collection(collName);
        const targetColl = targetDb.collection(collName);

        const count = await sourceColl.countDocuments();
        console.log(`\n--> Migrating collection [${collName}] (${count} documents)...`);

        if (count === 0) {
          // Create empty collection on target
          await targetDb.createCollection(collName).catch(() => {});
          migrationSummary.push({ db: dbName, collection: collName, count: 0, status: "Empty collection created" });
          continue;
        }

        // Migrate documents in batches
        const batchSize = 500;
        let processed = 0;
        const cursor = sourceColl.find({});

        let batch = [];
        while (await cursor.hasNext()) {
          const doc = await cursor.next();
          batch.push(doc);

          if (batch.length === batchSize) {
            await insertOrUpsertBatch(targetColl, batch);
            processed += batch.length;
            console.log(`    Migrated ${processed} / ${count} documents...`);
            batch = [];
          }
        }

        if (batch.length > 0) {
          await insertOrUpsertBatch(targetColl, batch);
          processed += batch.length;
          console.log(`    Migrated ${processed} / ${count} documents...`);
        }

        // Copy indexes (excluding default _id index)
        try {
          const indexes = await sourceColl.indexes();
          for (const idx of indexes) {
            if (idx.name === "_id_") continue;
            const { key, name, unique, sparse } = idx;
            await targetColl.createIndex(key, { name, unique, sparse }).catch(err => {
              console.warn(`    Warning on index [${name}]:`, err.message);
            });
          }
        } catch (idxErr) {
          console.warn(`    Could not copy indexes for [${collName}]:`, idxErr.message);
        }

        migrationSummary.push({ db: dbName, collection: collName, count: processed, status: "SUCCESS" });
      }
    }

    console.log(`\n========================================`);
    console.log(`MIGRATION COMPLETED SUCCESSFULLY!`);
    console.log(`========================================`);
    console.table(migrationSummary);

  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

async function insertOrUpsertBatch(targetColl, batch) {
  const operations = batch.map(doc => ({
    replaceOne: {
      filter: { _id: doc._id },
      replacement: doc,
      upsert: true,
    }
  }));

  await targetColl.bulkWrite(operations, { ordered: false });
}

migrate().catch(err => {
  console.error("\n[MIGRATION ERROR]:", err);
  process.exit(1);
});
