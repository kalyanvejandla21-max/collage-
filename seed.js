require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Question = require('./models/Question');
const Student = require('./models/Student');
const { subjectQuestionBanks } = require('./questions');

const sampleStudents = [
  { regNo: "23A91A0501", name: "Kalyan", year: "III B.Tech", section: "A" },
  { regNo: "24HP1A0541", name: "Kalyan", year: "III B.Tech", section: "A" },
  { regNo: "24HP1A0564", name: "G. Uday Kiran", year: "III B.Tech", section: "A" },
  { regNo: "24HPA10564", name: "G. Uday Kiran", year: "III B.Tech", section: "A" }
];

const seedDatabase = async () => {
  try {
    const isConnected = await connectDB();
    if (!isConnected) {
      console.error("❌ Cannot seed database: Could not establish MongoDB connection.");
      process.exit(1);
    }

    console.log("🧹 Clearing old Question and Student records from MongoDB...");
    await Question.deleteMany({});
    await Student.deleteMany({});

    console.log("🌱 Seeding Sample Students...");
    await Student.insertMany(sampleStudents);
    console.log(`✅ Seeded ${sampleStudents.length} sample student records.`);

    console.log("🌱 Seeding Question Banks...");
    let totalQuestions = 0;

    for (const [subjectName, questions] of Object.entries(subjectQuestionBanks)) {
      const questionDocs = questions.map(q => ({
        subject: subjectName,
        questionId: q.id,
        question: q.question,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation
      }));

      await Question.insertMany(questionDocs);
      console.log(`   └─ Seeded ${questionDocs.length} questions for: "${subjectName}"`);
      totalQuestions += questionDocs.length;
    }

    console.log(`\n🎉 Database Seeding Completed Successfully! Total Questions Seeded: ${totalQuestions}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
