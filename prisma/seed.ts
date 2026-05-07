import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const COURSES = [
  {
    title: "Java Full Stack",
    subtitle: "Core Java → Spring Boot → Microservices",
    category: "Programming",
    instructor: "Rahul Sharma",
    institute: "IIT Delhi",
    students: 45000,
    rating: 4.9,
    price: 999,
    isFree: false,
    totalHours: 80,
    totalVideos: 120,
    hasCert: true,
    color: "linear-gradient(135deg,#f97316,#ea580c)",
    icon: "fab fa-java",
    modules: [
      {
        title: "Module 1 — Java Basics",
        order: 1,
        lessons: [
          { title: "Variables & Data Types", duration: "12:30", isFree: true, order: 1, notes: "Variable is a container that stores data\nJava is statically typed\nPrimitives: int, float, double, char, boolean\nReference types: String, Arrays, Objects", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "OOP Concepts", duration: "18:45", isFree: true, order: 2, notes: "OOP stands for Object Oriented Programming\nFour pillars: Encapsulation, Inheritance, Polymorphism, Abstraction\nClass is a blueprint, Object is an instance", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "Inheritance & Polymorphism", duration: "22:10", isFree: false, order: 3, notes: "Inheritance allows a class to inherit properties from another class\nPolymorphism means many forms", videoUrl: "" },
        ],
      },
      {
        title: "Module 2 — Spring Boot",
        order: 2,
        lessons: [
          { title: "Spring Boot Setup", duration: "15:00", isFree: false, order: 1, notes: "Spring Boot simplifies Spring application setup\nAuto-configuration, embedded server", videoUrl: "" },
          { title: "REST API Development", duration: "28:20", isFree: false, order: 2, notes: "REST stands for Representational State Transfer\nHTTP methods: GET, POST, PUT, DELETE", videoUrl: "" },
        ],
      },
    ],
  },
  {
    title: "MERN Stack Bootcamp",
    subtitle: "MongoDB, Express, React, Node.js",
    category: "Web Dev",
    instructor: "Priya Nair",
    institute: "NIT Trichy",
    students: 32000,
    rating: 4.8,
    price: 799,
    isFree: false,
    totalHours: 60,
    totalVideos: 95,
    hasCert: true,
    color: "linear-gradient(135deg,#3b82f6,#1d4ed8)",
    icon: "fab fa-react",
    modules: [
      {
        title: "Module 1 — Node.js Basics",
        order: 1,
        lessons: [
          { title: "Node.js Introduction", duration: "10:00", isFree: true, order: 1, notes: "Node.js is a JavaScript runtime built on Chrome V8 engine\nNon-blocking I/O model", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "Express Setup", duration: "14:30", isFree: true, order: 2, notes: "Express is a minimal Node.js web framework\nMiddleware, routing, error handling", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "MongoDB Integration", duration: "20:00", isFree: false, order: 3, notes: "MongoDB is a NoSQL document database\nMongoose ODM for schema definition", videoUrl: "" },
        ],
      },
      {
        title: "Module 2 — React Frontend",
        order: 2,
        lessons: [
          { title: "React Components", duration: "16:00", isFree: false, order: 1, notes: "Components are building blocks of React\nFunctional vs Class components", videoUrl: "" },
          { title: "State & Props", duration: "18:00", isFree: false, order: 2, notes: "State is mutable data inside a component\nProps are read-only data passed from parent", videoUrl: "" },
        ],
      },
    ],
  },
  {
    title: "Data Science & ML",
    subtitle: "Python, Pandas, TensorFlow",
    category: "Data Science",
    instructor: "Amit Verma",
    institute: "IIT Bombay",
    students: 28000,
    rating: 4.9,
    price: 0,
    isFree: true,
    totalHours: 50,
    totalVideos: 80,
    hasCert: true,
    color: "linear-gradient(135deg,#8b5cf6,#6d28d9)",
    icon: "fab fa-python",
    modules: [
      {
        title: "Module 1 — Python Basics",
        order: 1,
        lessons: [
          { title: "Python Introduction", duration: "08:00", isFree: true, order: 1, notes: "Python is a high-level interpreted language\nSimple syntax, readable code", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "NumPy & Pandas", duration: "22:00", isFree: true, order: 2, notes: "NumPy for numerical computing\nPandas for data manipulation and analysis", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "Machine Learning Basics", duration: "30:00", isFree: false, order: 3, notes: "Supervised vs Unsupervised learning\nscikit-learn library for ML models", videoUrl: "" },
        ],
      },
    ],
  },
  {
    title: "DSA & Competitive Prog",
    subtitle: "Arrays, Trees, Graphs, DP",
    category: "DSA",
    instructor: "Vikram Singh",
    institute: "IIT Delhi",
    students: 38000,
    rating: 4.9,
    price: 899,
    isFree: false,
    totalHours: 70,
    totalVideos: 110,
    hasCert: true,
    color: "linear-gradient(135deg,#10b981,#059669)",
    icon: "fas fa-code",
    modules: [
      {
        title: "Module 1 — Arrays & Strings",
        order: 1,
        lessons: [
          { title: "Array Basics", duration: "11:00", isFree: true, order: 1, notes: "Array is a collection of elements of same type\nTime complexity: Access O(1), Search O(n)", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "Two Pointer Technique", duration: "16:00", isFree: true, order: 2, notes: "Two pointer is used to solve array problems efficiently\nReduces time complexity from O(n²) to O(n)", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "Dynamic Programming", duration: "35:00", isFree: false, order: 3, notes: "DP breaks problem into subproblems\nMemoization and Tabulation approaches", videoUrl: "" },
        ],
      },
    ],
  },
  {
    title: "JavaScript Mastery",
    subtitle: "ES6+, DOM, Async/Await",
    category: "Web Dev",
    instructor: "Sneha Gupta",
    institute: "BITS Pilani",
    students: 22000,
    rating: 4.7,
    price: 0,
    isFree: true,
    totalHours: 40,
    totalVideos: 65,
    hasCert: true,
    color: "linear-gradient(135deg,#f59e0b,#d97706)",
    icon: "fab fa-js",
    modules: [
      {
        title: "Module 1 — JS Fundamentals",
        order: 1,
        lessons: [
          { title: "Variables & Scope", duration: "09:00", isFree: true, order: 1, notes: "var, let, const differences\nScope: global, function, block", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "ES6+ Features", duration: "20:00", isFree: true, order: 2, notes: "Arrow functions, destructuring, spread operator\nTemplate literals, optional chaining", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "Async/Await & Promises", duration: "25:00", isFree: false, order: 3, notes: "Promise is a placeholder for future value\nasync/await makes async code look synchronous", videoUrl: "" },
        ],
      },
    ],
  },
  {
    title: "SQL & Database Design",
    subtitle: "MySQL, PostgreSQL, Indexing",
    category: "Programming",
    instructor: "Ravi Kumar",
    institute: "NIT Warangal",
    students: 18000,
    rating: 4.8,
    price: 599,
    isFree: false,
    totalHours: 35,
    totalVideos: 55,
    hasCert: true,
    color: "linear-gradient(135deg,#ec4899,#be185d)",
    icon: "fas fa-database",
    modules: [
      {
        title: "Module 1 — SQL Basics",
        order: 1,
        lessons: [
          { title: "SELECT & WHERE", duration: "10:00", isFree: true, order: 1, notes: "SELECT retrieves data from tables\nWHERE filters rows based on conditions", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "JOINs Explained", duration: "18:00", isFree: true, order: 2, notes: "INNER JOIN returns matching rows from both tables\nLEFT JOIN returns all rows from left table", videoUrl: "https://www.youtube.com/embed/eIrMbAQSU34" },
          { title: "Indexing & Performance", duration: "22:00", isFree: false, order: 3, notes: "Index speeds up data retrieval\nB-tree index is most common type", videoUrl: "" },
        ],
      },
    ],
  },
];

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data (safe for dev)
  await prisma.progress.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  console.log("👤 Creating admin user...");
  const hashedPassword = await bcrypt.hash("Admin@123", 10);
  const adminUser = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@codingkeda.com",
      password: hashedPassword,
      role: "admin",
    },
  });
  console.log(`✅ Admin created: ${adminUser.email}`);
  console.log(`   Password: Admin@123`);

  // Create test regular user
  console.log("👤 Creating test user...");
  const testPassword = await bcrypt.hash("Test@123", 10);
  const testUser = await prisma.user.create({
    data: {
      name: "Test User",
      email: "test@codingkeda.com",
      password: testPassword,
      role: "user",
    },
  });
  console.log(`✅ Test user created: ${testUser.email}`);
  console.log(`   Password: Test@123`);

  console.log("\n📚 Seeding courses...");

  for (const courseData of COURSES) {
    const { modules, ...courseFields } = courseData;

    const course = await prisma.course.create({
      data: {
        ...courseFields,
        modules: {
          create: modules.map((mod) => ({
            title: mod.title,
            order: mod.order,
            lessons: {
              create: mod.lessons.map((lesson) => ({
                title: lesson.title,
                duration: lesson.duration,
                isFree: lesson.isFree,
                order: lesson.order,
                notes: lesson.notes,
                videoUrl: lesson.videoUrl,
              })),
            },
          })),
        },
      },
    });

    console.log(`✅ Created: ${course.title}`);
  }

  console.log("\n✅ Seeding complete!");
  console.log("\n📋 Login Credentials:");
  console.log("   Admin: admin@codingkeda.com / Admin@123");
  console.log("   User:  test@codingkeda.com / Test@123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
