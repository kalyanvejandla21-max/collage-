require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Question = require('./models/Question');
const Student = require('./models/Student');
const { subjectQuestionBanks } = require('./questions');

const fs = require('fs');
const path = require('path');

let masterStudents = [];
try {
  const masterPath = path.join(__dirname, 'data', 'students_master.json');
  if (fs.existsSync(masterPath)) {
    masterStudents = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
  }
} catch (e) {
  console.warn('⚠️ Could not load students_master.json:', e.message);
}

const facultyAccounts = [
  {
    regNo: 'FACULTY01',
    name: 'Faculty Coordinator',
    year: 'Faculty',
    section: 'CSE',
    password: 'admin123',
    role: 'FACULTY',
    assignedSubjects: ['Computer Networks', 'Finite Automata', 'Data Warehouse and Data Mining', 'Fundamentals of Computing']
  },
  {
    regNo: 'FACULTY_CN',
    name: 'Prof. Ramesh (CN/FA)',
    year: 'Faculty',
    section: 'CSE',
    password: 'admin123',
    role: 'FACULTY',
    assignedSubjects: ['Computer Networks', 'Finite Automata']
  },
  {
    regNo: 'FACULTY_DW',
    name: 'Prof. Suresh (DWDM/FC)',
    year: 'Faculty',
    section: 'CSE',
    password: 'admin123',
    role: 'FACULTY',
    assignedSubjects: ['Data Warehouse and Data Mining', 'Fundamentals of Computing']
  }
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

    console.log(`🌱 Seeding Master Students (${masterStudents.length} records)...`);
    const studentDocs = masterStudents.map(s => ({
      regNo: s.regNo || s.hallticket,
      name: s.name,
      department: s.department || 'CSE',
      course: s.course || 'B.Tech',
      year: String(s.year || '3'),
      semester: String(s.semester || '1'),
      section: s.section || 'A',
      photo_url: s.photo_url || '',
      password: 'password123',
      role: 'STUDENT',
      isActive: true
    }));

    if (studentDocs.length > 0) {
      await Student.insertMany(studentDocs);
      console.log(`✅ Seeded ${studentDocs.length} master student records.`);
    }

    console.log("🌱 Seeding Faculty Accounts...");
    await Student.insertMany(facultyAccounts);
    console.log(`✅ Seeded ${facultyAccounts.length} faculty coordinator records.`);


    console.log("🌱 Seeding Question Banks...");
    let totalQuestions = 0;

    for (const [subjectName, questions] of Object.entries(subjectQuestionBanks)) {
      const questionDocs = questions.map((q, idx) => {
        const rawDiff = q.difficulty || (idx % 3 === 0 ? 'Easy' : (idx % 3 === 1 ? 'Medium' : 'Hard'));
        const diffUpper = String(rawDiff).trim().toUpperCase();
        let difficulty = 'Medium';
        let marks = 2;

        if (diffUpper === 'EASY') {
          difficulty = 'Easy';
          marks = 1;
        } else if (diffUpper === 'HARD') {
          difficulty = 'Hard';
          marks = 2;
        } else {
          difficulty = 'Medium';
          marks = 2;
        }

        return {
          subject: subjectName,
          questionId: q.id || q.questionId || (idx + 1),
          question: q.question,
          options: q.options,
          correct: q.correct,
          difficulty,
          marks,
          hint: q.hint || `Analyze core principles of ${subjectName}.`,
          explanation: q.explanation
        };
      });

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
