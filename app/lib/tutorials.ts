/**
 * Free beginner tutorials shown on /learn. Plain data (browser-safe) so the
 * playground can load any example with ?example=<lang>/<topic>.
 */

export type LangId = "python" | "java" | "c";

export type Block =
  | { kind: "text"; text: string }
  | { kind: "tip"; text: string }
  | { kind: "code"; code: string; output?: string };

export interface Topic {
  slug: string;
  title: string;
  emoji: string;
  summary: string;
  blocks: Block[];
  /** Code opened by "Try it yourself". */
  tryCode: string;
  quiz: { q: string; options: string[]; answer: number; why: string };
}

export interface Language {
  id: LangId;
  name: string;
  emoji: string;
  tagline: string;
  color: { bg: string; edge: string; ink: string; btn: string };
  topics: Topic[];
}

export const LANGUAGES: Language[] = [
  {
    id: "python",
    name: "Python",
    emoji: "🐍",
    tagline: "The friendliest first language. Reads almost like English.",
    color: { bg: "bg-[#DCFCE7]", edge: "border-[#86EFAC]", ink: "text-[#15803D]", btn: "bg-[#22C55E] border-[#15803D]" },
    topics: [
      {
        slug: "hello-world",
        title: "Your first program",
        emoji: "👋",
        summary: "Make the computer say hello with print().",
        blocks: [
          { kind: "text", text: "A program is a list of instructions for the computer. In Python, print() shows text on the screen." },
          { kind: "code", code: 'print("Hello, CodingKida!")\nprint("I am learning Python")', output: "Hello, CodingKida!\nI am learning Python" },
          { kind: "text", text: "Text must be inside quotes. Each print() starts a new line." },
          { kind: "tip", text: "Try changing the words inside the quotes and run it again." },
        ],
        tryCode: 'print("Hello, CodingKida!")\nprint("My name is ...")',
        quiz: { q: "Which line prints Hi on the screen?", options: ["print(Hi)", 'print("Hi")', 'say("Hi")'], answer: 1, why: "Text must be inside quotes, and Python uses print()." },
      },
      {
        slug: "variables",
        title: "Variables",
        emoji: "📦",
        summary: "Store numbers and words in named boxes.",
        blocks: [
          { kind: "text", text: "A variable is a box with a name. You put a value in it with =, and use the name later." },
          { kind: "code", code: 'name = "Aarav"\nage = 11\nprint(name, "is", age, "years old")', output: "Aarav is 11 years old" },
          { kind: "text", text: "You can change what is in the box. The newest value wins." },
          { kind: "code", code: "score = 10\nscore = score + 5\nprint(score)", output: "15" },
          { kind: "tip", text: "Variable names cannot have spaces. Use my_score, not my score." },
        ],
        tryCode: 'name = "Your name"\nage = 10\nprint(name, "is", age)\nage = age + 1\nprint("Next year:", age)',
        quiz: { q: "After x = 4 and then x = x * 2, what is x?", options: ["4", "6", "8"], answer: 2, why: "x * 2 is 4 × 2 = 8, and that new value is stored in x." },
      },
      {
        slug: "if-else",
        title: "Making decisions with if",
        emoji: "🚦",
        summary: "Run different code depending on a condition.",
        blocks: [
          { kind: "text", text: "if checks a condition. If it is true, the indented lines run. else runs when it is false." },
          { kind: "code", code: 'marks = 72\nif marks >= 60:\n    print("You passed! 🎉")\nelse:\n    print("Keep practising!")', output: "You passed! 🎉" },
          { kind: "text", text: "Use == to check if two things are equal, != for not equal, and > < >= <= to compare." },
          { kind: "tip", text: "The lines inside if must be indented (moved right) by 4 spaces." },
        ],
        tryCode: 'marks = 45\nif marks >= 90:\n    print("Gold 🥇")\nelif marks >= 60:\n    print("Passed")\nelse:\n    print("Try again")',
        quiz: { q: "Which sign checks if two values are equal?", options: ["=", "==", "=>"], answer: 1, why: "A single = stores a value. == compares two values." },
      },
      {
        slug: "loops",
        title: "Loops",
        emoji: "🔁",
        summary: "Repeat code without writing it again and again.",
        blocks: [
          { kind: "text", text: "A for loop repeats code. range(5) gives the numbers 0, 1, 2, 3, 4." },
          { kind: "code", code: 'for i in range(1, 6):\n    print("Star", i, "⭐")', output: "Star 1 ⭐\nStar 2 ⭐\nStar 3 ⭐\nStar 4 ⭐\nStar 5 ⭐" },
          { kind: "text", text: "A while loop repeats as long as a condition stays true." },
          { kind: "code", code: "count = 3\nwhile count > 0:\n    print(count)\n    count = count - 1\nprint(\"Blast off! 🚀\")", output: "3\n2\n1\nBlast off! 🚀" },
          { kind: "tip", text: "Always change the variable inside a while loop, or it will never stop." },
        ],
        tryCode: 'n = 5\nfor i in range(1, 11):\n    print(n, "x", i, "=", n * i)',
        quiz: { q: "How many times does for i in range(3) run?", options: ["2", "3", "4"], answer: 1, why: "range(3) gives 0, 1 and 2: three numbers, so three times." },
      },
      {
        slug: "lists",
        title: "Lists",
        emoji: "🧺",
        summary: "Keep many values together in one list.",
        blocks: [
          { kind: "text", text: "A list holds many values in order, inside square brackets. The first item is at position 0." },
          { kind: "code", code: 'fruits = ["mango", "apple", "banana"]\nprint(fruits[0])\nfruits.append("grapes")\nprint(len(fruits), "fruits")', output: "mango\n4 fruits" },
          { kind: "code", code: "marks = [80, 65, 92]\nprint(\"Total:\", sum(marks))\nprint(\"Best:\", max(marks))", output: "Total: 237\nBest: 92" },
        ],
        tryCode: 'friends = ["Riya", "Kabir", "Meera"]\nfor f in friends:\n    print("Hello", f)',
        quiz: { q: 'In ["a", "b", "c"], which position is "b"?', options: ["0", "1", "2"], answer: 1, why: "Counting starts at 0, so a is 0 and b is 1." },
      },
    ],
  },
  {
    id: "java",
    name: "Java",
    emoji: "☕",
    tagline: "Used for Android apps and big software. Great for school exams.",
    color: { bg: "bg-[#FFEDD5]", edge: "border-[#FDBA74]", ink: "text-[#C2410C]", btn: "bg-[#F97316] border-[#C2410C]" },
    topics: [
      {
        slug: "hello-world",
        title: "Your first Java program",
        emoji: "👋",
        summary: "Every Java program starts inside a class with a main method.",
        blocks: [
          { kind: "text", text: "Java code lives inside a class. The program starts running from main." },
          { kind: "code", code: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, CodingKida!");\n    }\n}', output: "Hello, CodingKida!" },
          { kind: "text", text: "System.out.println() prints a line. Every statement ends with a semicolon ;" },
          { kind: "tip", text: "Java is case-sensitive: System and system are different." },
        ],
        tryCode: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, CodingKida!");\n        System.out.println("Java is fun");\n    }\n}',
        quiz: { q: "Where does a Java program start running?", options: ["At the class name", "In the main method", "At the last line"], answer: 1, why: "Java always starts from public static void main." },
      },
      {
        slug: "variables",
        title: "Variables and types",
        emoji: "📦",
        summary: "In Java you say what kind of value a variable holds.",
        blocks: [
          { kind: "text", text: "int holds whole numbers, double holds decimals, String holds text and boolean holds true or false." },
          { kind: "code", code: 'public class Main {\n    public static void main(String[] args) {\n        String name = "Riya";\n        int age = 12;\n        double height = 1.45;\n        System.out.println(name + " is " + age);\n        System.out.println("Height: " + height + " m");\n    }\n}', output: "Riya is 12\nHeight: 1.45 m" },
          { kind: "tip", text: "Use + to join text and values together." },
        ],
        tryCode: 'public class Main {\n    public static void main(String[] args) {\n        int a = 7;\n        int b = 3;\n        System.out.println("Sum: " + (a + b));\n        System.out.println("Product: " + (a * b));\n    }\n}',
        quiz: { q: "Which type stores 3.5?", options: ["int", "double", "String"], answer: 1, why: "double stores numbers with a decimal point." },
      },
      {
        slug: "loops",
        title: "Loops in Java",
        emoji: "🔁",
        summary: "Repeat code with for and while.",
        blocks: [
          { kind: "text", text: "A for loop has three parts: start, condition and step." },
          { kind: "code", code: 'public class Main {\n    public static void main(String[] args) {\n        for (int i = 1; i <= 5; i++) {\n            System.out.println("Level " + i);\n        }\n    }\n}', output: "Level 1\nLevel 2\nLevel 3\nLevel 4\nLevel 5" },
          { kind: "tip", text: "i++ means add 1 to i." },
        ],
        tryCode: 'public class Main {\n    public static void main(String[] args) {\n        int sum = 0;\n        for (int i = 1; i <= 10; i++) {\n            sum = sum + i;\n        }\n        System.out.println("1 + 2 + ... + 10 = " + sum);\n    }\n}',
        quiz: { q: "What does i++ do?", options: ["Adds 1 to i", "Multiplies i by 2", "Prints i"], answer: 0, why: "i++ is a short way of writing i = i + 1." },
      },
    ],
  },
  {
    id: "c",
    name: "C",
    emoji: "🔧",
    tagline: "The language behind computers and games. Learn how things work inside.",
    color: { bg: "bg-[#E0F2FE]", edge: "border-[#7DD3FC]", ink: "text-[#0369A1]", btn: "bg-[#0EA5E9] border-[#0369A1]" },
    topics: [
      {
        slug: "hello-world",
        title: "Your first C program",
        emoji: "👋",
        summary: "Use printf to print text from main.",
        blocks: [
          { kind: "text", text: "#include <stdio.h> lets us use printf. The program starts in main." },
          { kind: "code", code: '#include <stdio.h>\n\nint main() {\n    printf("Hello, CodingKida!\\n");\n    return 0;\n}', output: "Hello, CodingKida!" },
          { kind: "text", text: "\\n means new line. return 0 tells the computer the program finished well." },
        ],
        tryCode: '#include <stdio.h>\n\nint main() {\n    printf("Hello, CodingKida!\\n");\n    printf("C is powerful\\n");\n    return 0;\n}',
        quiz: { q: "What does \\n do in printf?", options: ["Prints the letter n", "Starts a new line", "Ends the program"], answer: 1, why: "\\n is the new line character." },
      },
      {
        slug: "variables",
        title: "Variables in C",
        emoji: "📦",
        summary: "Store numbers and print them with format codes.",
        blocks: [
          { kind: "text", text: "int stores whole numbers and float stores decimals. In printf, %d prints an int and %f prints a float." },
          { kind: "code", code: '#include <stdio.h>\n\nint main() {\n    int apples = 5;\n    float price = 12.5;\n    printf("%d apples cost %.2f\\n", apples, apples * price);\n    return 0;\n}', output: "5 apples cost 62.50" },
          { kind: "tip", text: "%.2f prints 2 numbers after the decimal point." },
        ],
        tryCode: '#include <stdio.h>\n\nint main() {\n    int length = 8, width = 5;\n    printf("Area = %d\\n", length * width);\n    return 0;\n}',
        quiz: { q: "Which format code prints an int?", options: ["%d", "%f", "%s"], answer: 0, why: "%d is for whole numbers (integers)." },
      },
      {
        slug: "loops",
        title: "Loops in C",
        emoji: "🔁",
        summary: "Repeat code with for loops.",
        blocks: [
          { kind: "text", text: "A for loop in C looks just like Java: start, condition and step." },
          { kind: "code", code: '#include <stdio.h>\n\nint main() {\n    for (int i = 1; i <= 5; i++) {\n        printf("%d squared is %d\\n", i, i * i);\n    }\n    return 0;\n}', output: "1 squared is 1\n2 squared is 4\n3 squared is 9\n4 squared is 16\n5 squared is 25" },
        ],
        tryCode: '#include <stdio.h>\n\nint main() {\n    for (int i = 10; i >= 1; i--) {\n        printf("%d ", i);\n    }\n    printf("Go! 🚀\\n");\n    return 0;\n}',
        quiz: { q: "What does i-- do?", options: ["Adds 1", "Takes away 1", "Doubles i"], answer: 1, why: "i-- is short for i = i - 1." },
      },
    ],
  },
];

export function getLanguage(id: string) {
  return LANGUAGES.find((l) => l.id === id) ?? null;
}

export function getTopic(lang: string, slug: string) {
  const l = getLanguage(lang);
  const index = l ? l.topics.findIndex((t) => t.slug === slug) : -1;
  if (!l || index === -1) return null;
  return { language: l, topic: l.topics[index], prev: l.topics[index - 1] ?? null, next: l.topics[index + 1] ?? null };
}

/** "python/loops" → the try-it code and language, for the playground. */
export function exampleFor(ref: string | null) {
  if (!ref) return null;
  const [lang, slug] = ref.split("/");
  const found = getTopic(lang, slug);
  return found ? { lang: found.language.id, code: found.topic.tryCode, title: found.topic.title } : null;
}
