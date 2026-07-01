import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/coding-problems
 * Returns default coding practice problems for the playground.
 * These are static problems (like LeetCode/GFG) available to all users.
 * No auth required — problems are public.
 */
export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get("category") || "all";
    const difficulty = req.nextUrl.searchParams.get("difficulty") || "all";

    let filtered = CODING_PROBLEMS;

    if (category !== "all") {
      filtered = filtered.filter((p) => p.category === category);
    }
    if (difficulty !== "all") {
      filtered = filtered.filter((p) => p.difficulty === difficulty);
    }

    return NextResponse.json({
      success: true,
      problems: filtered,
      total: filtered.length,
      categories: CATEGORIES,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error." },
      { status: 500 }
    );
  }
}

const CATEGORIES = [
  "Arrays",
  "Strings",
  "Math",
  "Sorting",
  "Searching",
  "Recursion",
  "Linked List",
  "Stack & Queue",
  "Trees",
  "Dynamic Programming",
];

interface CodingProblem {
  id: string;
  title: string;
  description: string;
  inputFormat?: string;
  outputFormat?: string;
  explanation?: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  defaultLanguage: string;
  constraints?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  starterCode: Record<string, string>;
  testCases: { input: string; expectedOutput: string; isHidden: boolean }[];
  hints: string[];
  tags?: string[];
}

const CODING_PROBLEMS: CodingProblem[] = [
  // ═══ ARRAYS (10 problems) ═══
  {
    id: "arr-1", title: "Two Sum", category: "Arrays", difficulty: "easy", defaultLanguage: "c",
    description: "Given an array of integers and a target sum, find two numbers that add up to the target. Print their 0-based indices separated by space.",
    inputFormat: "First line: N (array size) and target (space-separated)\nSecond line: N space-separated integers",
    outputFormat: "Two space-separated indices (0-based) of elements that sum to target",
    constraints: "2 ≤ N ≤ 10⁴\n-10⁹ ≤ arr[i] ≤ 10⁹\nExactly one solution exists.",
    timeComplexity: "O(n)", spaceComplexity: "O(n)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n,target;\n    scanf(\"%d%d\",&n,&target);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n,target;\n    cin>>n>>target;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int target = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n, target = int(input()), int(input())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst [n, target] = lines[0].split(' ').map(Number);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "4 9\n2 7 11 15", expectedOutput: "0 1", isHidden: false }, { input: "3 6\n3 2 4", expectedOutput: "1 2", isHidden: false }, { input: "5 10\n1 2 3 4 6", expectedOutput: "3 4", isHidden: true } ],
    hints: ["Use a hash map to store seen values.", "For each element, check if target - element exists in the map."],
    explanation: "For the first example: arr=[2,7,11,15], target=9. Elements at indices 0 and 1 (values 2 and 7) sum to 9.",
    tags: ["array", "hash-map", "two-pointer"]
  },
  {
    id: "arr-2", title: "Find Maximum", category: "Arrays", difficulty: "easy", defaultLanguage: "c",
    description: "Given an array of N integers, find and print the maximum element.",
    inputFormat: "First line: N (array size)\nSecond line: N space-separated integers",
    outputFormat: "Single integer - the maximum element",
    constraints: "1 ≤ N ≤ 10⁵\n-10⁹ ≤ arr[i] ≤ 10⁹",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "5\n3 1 4 1 5", expectedOutput: "5", isHidden: false }, { input: "3\n-1 -5 -2", expectedOutput: "-1", isHidden: false }, { input: "1\n42", expectedOutput: "42", isHidden: true } ],
    hints: ["Initialize max with the first element.", "Loop through and compare each element."],
    explanation: "For array [3,1,4,1,5], the maximum element is 5.",
    tags: ["array", "iteration", "max-finding"]
  },
  {
    id: "arr-3", title: "Reverse Array", category: "Arrays", difficulty: "easy", defaultLanguage: "c",
    description: "Given an array of N integers, print the array in reverse order (space separated).",
    inputFormat: "First line: N (array size)\nSecond line: N space-separated integers",
    outputFormat: "N space-separated integers in reverse order",
    constraints: "1 ≤ N ≤ 10⁵\n-10⁹ ≤ arr[i] ≤ 10⁹",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "5\n1 2 3 4 5", expectedOutput: "5 4 3 2 1", isHidden: false }, { input: "3\n10 20 30", expectedOutput: "30 20 10", isHidden: true } ],
    hints: ["Use a loop from end to start.", "Or use two pointers and swap."],
    explanation: "For array [1,2,3,4,5], the reversed array is [5,4,3,2,1].",
    tags: ["array", "two-pointer", "reverse"]
  },
  {
    id: "arr-4", title: "Count Even Numbers", category: "Arrays", difficulty: "easy", defaultLanguage: "python",
    description: "Given an array of N integers, count and print how many even numbers are in the array.",
    inputFormat: "First line: N (array size)\nSecond line: N space-separated integers",
    outputFormat: "Single integer - count of even numbers",
    constraints: "1 ≤ N ≤ 10⁵\n-10⁹ ≤ arr[i] ≤ 10⁹",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "5\n1 2 3 4 5", expectedOutput: "2", isHidden: false }, { input: "4\n2 4 6 8", expectedOutput: "4", isHidden: false }, { input: "3\n1 3 5", expectedOutput: "0", isHidden: true } ],
    hints: ["A number is even if num % 2 == 0."],
    explanation: "For array [1,2,3,4,5], there are 2 even numbers (2 and 4).",
    tags: ["array", "modulo", "counting"]
  },
  {
    id: "arr-5", title: "Array Sum", category: "Arrays", difficulty: "easy", defaultLanguage: "c",
    description: "Given an array of N integers, print the sum of all elements.",
    inputFormat: "First line: N (array size)\nSecond line: N space-separated integers",
    outputFormat: "Single integer - sum of all elements",
    constraints: "1 ≤ N ≤ 10⁵\n-10⁹ ≤ arr[i] ≤ 10⁹",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "5\n1 2 3 4 5", expectedOutput: "15", isHidden: false }, { input: "3\n-1 0 1", expectedOutput: "0", isHidden: true } ],
    hints: ["Use a loop to accumulate the sum."],
    explanation: "For array [1,2,3,4,5], the sum is 1+2+3+4+5 = 15.",
    tags: ["array", "sum", "iteration"]
  },
  {
    id: "arr-6", title: "Second Largest", category: "Arrays", difficulty: "medium", defaultLanguage: "c",
    description: "Given an array of N integers, find and print the second largest element. If no second largest exists, print -1.",
    inputFormat: "First line: N (array size)\nSecond line: N space-separated integers",
    outputFormat: "Single integer - second largest element or -1",
    constraints: "2 ≤ N ≤ 10⁵\n-10⁹ ≤ arr[i] ≤ 10⁹",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "5\n10 20 30 40 50", expectedOutput: "40", isHidden: false }, { input: "3\n5 5 5", expectedOutput: "-1", isHidden: false }, { input: "4\n1 2 2 3", expectedOutput: "2", isHidden: true } ],
    hints: ["Track both the largest and second largest.", "Handle duplicates carefully."],
    explanation: "For [10,20,30,40,50], the second largest is 40. For [5,5,5], all are same so return -1.",
    tags: ["array", "searching", "two-variables"]
  },
  {
    id: "arr-7", title: "Move Zeros to End", category: "Arrays", difficulty: "medium", defaultLanguage: "c",
    description: "Given an array, move all zeros to the end while maintaining the relative order of non-zero elements. Print the result space-separated.",
    inputFormat: "First line: N (array size)\nSecond line: N space-separated integers",
    outputFormat: "N space-separated integers with zeros moved to end",
    constraints: "1 ≤ N ≤ 10⁵\n0 ≤ arr[i] ≤ 10⁹",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "5\n0 1 0 3 12", expectedOutput: "1 3 12 0 0", isHidden: false }, { input: "4\n0 0 0 1", expectedOutput: "1 0 0 0", isHidden: true } ],
    hints: ["Use two-pointer technique.", "Keep a pointer for the next non-zero position."],
    explanation: "For [0,1,0,3,12], move zeros to end: [1,3,12,0,0]. Relative order of non-zeros is maintained.",
    tags: ["array", "two-pointer", "in-place"]
  },
  {
    id: "arr-8", title: "Rotate Array Left", category: "Arrays", difficulty: "medium", defaultLanguage: "c",
    description: "Given an array of N integers and a number K, rotate the array left by K positions. Print the result space-separated.",
    inputFormat: "First line: N (array size) and K (rotation count) space-separated\nSecond line: N space-separated integers",
    outputFormat: "N space-separated integers after left rotation by K",
    constraints: "1 ≤ N ≤ 10⁵\n1 ≤ K ≤ N\n-10⁹ ≤ arr[i] ≤ 10⁹",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n,k;\n    scanf(\"%d%d\",&n,&k);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n,k;\n    cin>>n>>k;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int k = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n, k = map(int, input().split())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst [n, k] = lines[0].split(' ').map(Number);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "5 2\n1 2 3 4 5", expectedOutput: "3 4 5 1 2", isHidden: false }, { input: "4 1\n10 20 30 40", expectedOutput: "20 30 40 10", isHidden: true } ],
    hints: ["Use modulo to handle k > n.", "Slice and concatenate, or use reversal algorithm."],
    explanation: "For [1,2,3,4,5] rotated left by 2: [3,4,5,1,2].",
    tags: ["array", "rotation", "modulo"]
  },
  {
    id: "arr-9", title: "Kadane's Algorithm", category: "Arrays", difficulty: "hard", defaultLanguage: "c",
    description: "Given an array of N integers (can be negative), find the maximum sum contiguous subarray and print the sum.",
    inputFormat: "First line: N (array size)\nSecond line: N space-separated integers",
    outputFormat: "Single integer - maximum subarray sum",
    constraints: "1 ≤ N ≤ 10⁵\n-10⁴ ≤ arr[i] ≤ 10⁴",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "8\n-2 1 -3 4 -1 2 1 -5", expectedOutput: "6", isHidden: false }, { input: "5\n-1 -2 -3 -4 -5", expectedOutput: "-1", isHidden: false }, { input: "3\n5 -2 7", expectedOutput: "10", isHidden: true } ],
    hints: ["Track current_sum and max_sum.", "Reset current_sum when it becomes negative."],
    explanation: "For [-2,1,-3,4,-1,2,1,-5], subarray [4,-1,2,1] has max sum = 6.",
    tags: ["array", "dynamic-programming", "kadane"]
  },
  {
    id: "arr-10", title: "Merge Two Sorted Arrays", category: "Arrays", difficulty: "medium", defaultLanguage: "c",
    description: "Given two sorted arrays of sizes N and M, merge them into a single sorted array. Print space-separated.",
    inputFormat: "First line: N and M (space-separated)\nSecond line: N space-separated integers (sorted)\nThird line: M space-separated integers (sorted)",
    outputFormat: "(N+M) space-separated integers in sorted order",
    constraints: "1 ≤ N, M ≤ 10⁴\n-10⁹ ≤ elements ≤ 10⁹",
    timeComplexity: "O(n+m)", spaceComplexity: "O(n+m)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n,m;\n    scanf(\"%d%d\",&n,&m);\n    int a[n],b[m];\n    for(int i=0;i<n;i++) scanf(\"%d\",&a[i]);\n    for(int i=0;i<m;i++) scanf(\"%d\",&b[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n,m;\n    cin>>n>>m;\n    int a[n],b[m];\n    for(int i=0;i<n;i++) cin>>a[i];\n    for(int i=0;i<m;i++) cin>>b[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int m = sc.nextInt();\n        int[] a = new int[n];\n        int[] b = new int[m];\n        for(int i=0;i<n;i++) a[i] = sc.nextInt();\n        for(int i=0;i<m;i++) b[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n, m = map(int, input().split())\na = list(map(int, input().split()))\nb = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst [n, m] = lines[0].split(' ').map(Number);\nconst a = lines[1].split(' ').map(Number);\nconst b = lines[2].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "3 3\n1 3 5\n2 4 6", expectedOutput: "1 2 3 4 5 6", isHidden: false }, { input: "2 3\n1 8\n2 3 4", expectedOutput: "1 2 3 4 8", isHidden: true } ],
    hints: ["Use two pointers, one for each array.", "Compare and pick the smaller element."],
    explanation: "Merge [1,3,5] and [2,4,6] using two pointers: [1,2,3,4,5,6].",
    tags: ["array", "two-pointer", "merge"]
  },
  // ═══ STRINGS (10 problems) ═══
  {
    id: "str-1", title: "Reverse String", category: "Strings", difficulty: "easy", defaultLanguage: "python",
    description: "Given a string, print it reversed.",
    inputFormat: "Single line: a string s",
    outputFormat: "The reversed string",
    constraints: "1 ≤ |s| ≤ 10⁵\ns contains lowercase English letters.",
    timeComplexity: "O(n)", spaceComplexity: "O(n)",
    starterCode: { c: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[100001];\n    scanf(\"%s\",s);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\n#include<string>\nusing namespace std;\nint main(){\n    string s;\n    cin>>s;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.next();\n        // Your code here\n    }\n}", python: "s = input()\n# Your code here\n", javascript: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\n// Your code here\n" },
    testCases: [ { input: "hello", expectedOutput: "olleh", isHidden: false }, { input: "abc", expectedOutput: "cba", isHidden: true } ],
    hints: ["Use slicing in Python: s[::-1]", "In C++ use reverse() or loop from end."],
    explanation: "Reverse of 'hello' is 'olleh'.",
    tags: ["string", "reverse", "basic"]
  },
  {
    id: "str-2", title: "Palindrome Check", category: "Strings", difficulty: "easy", defaultLanguage: "python",
    description: "Given a string, print 'Yes' if it is a palindrome, otherwise print 'No'. (Case-sensitive)",
    inputFormat: "Single line: a string s",
    outputFormat: "'Yes' or 'No'",
    constraints: "1 ≤ |s| ≤ 10⁵\ns contains alphanumeric characters.",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[100001];\n    scanf(\"%s\",s);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\n#include<string>\nusing namespace std;\nint main(){\n    string s;\n    cin>>s;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.next();\n        // Your code here\n    }\n}", python: "s = input()\n# Your code here\n", javascript: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\n// Your code here\n" },
    testCases: [ { input: "racecar", expectedOutput: "Yes", isHidden: false }, { input: "hello", expectedOutput: "No", isHidden: false }, { input: "a", expectedOutput: "Yes", isHidden: true } ],
    hints: ["Compare the string with its reverse."],
    explanation: "'racecar' reads same forwards and backwards.",
    tags: ["string", "palindrome", "two-pointer"]
  },
  {
    id: "str-3", title: "Count Vowels", category: "Strings", difficulty: "easy", defaultLanguage: "python",
    description: "Given a string, count and print the number of vowels (a,e,i,o,u — both upper and lower case).",
    inputFormat: "Single line: a string s (may contain spaces)",
    outputFormat: "Single integer - count of vowels",
    constraints: "1 ≤ |s| ≤ 10⁵",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[100001];\n    fgets(s,100001,stdin);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\n#include<string>\nusing namespace std;\nint main(){\n    string s;\n    getline(cin,s);\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.nextLine();\n        // Your code here\n    }\n}", python: "s = input()\n# Your code here\n", javascript: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\n// Your code here\n" },
    testCases: [ { input: "Hello World", expectedOutput: "3", isHidden: false }, { input: "aeiou", expectedOutput: "5", isHidden: true } ],
    hints: ["Check each character against 'aeiouAEIOU'."],
    explanation: "'Hello World' has vowels: e, o, o = 3 vowels.",
    tags: ["string", "counting", "vowels"]
  },
  {
    id: "str-4", title: "Anagram Check", category: "Strings", difficulty: "medium", defaultLanguage: "python",
    description: "Given two strings, print 'Yes' if they are anagrams of each other, otherwise 'No'. (Case-insensitive)",
    inputFormat: "First line: string a\nSecond line: string b",
    outputFormat: "'Yes' or 'No'",
    constraints: "1 ≤ |a|, |b| ≤ 10⁵\nStrings contain English letters only.",
    timeComplexity: "O(n log n)", spaceComplexity: "O(n)",
    starterCode: { c: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char a[100001],b[100001];\n    scanf(\"%s\",a);\n    scanf(\"%s\",b);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\n#include<string>\n#include<algorithm>\nusing namespace std;\nint main(){\n    string a,b;\n    cin>>a>>b;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String a = sc.next();\n        String b = sc.next();\n        // Your code here\n    }\n}", python: "a = input()\nb = input()\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst a = lines[0], b = lines[1];\n// Your code here\n" },
    testCases: [ { input: "listen\nsilent", expectedOutput: "Yes", isHidden: false }, { input: "hello\nworld", expectedOutput: "No", isHidden: false }, { input: "Astronomer\nMoonStarer", expectedOutput: "Yes", isHidden: true } ],
    hints: ["Sort both strings and compare.", "Or use character frequency count."],
    explanation: "'listen' and 'silent' have same characters in different order.",
    tags: ["string", "anagram", "sorting", "hash-map"]
  },
  {
    id: "str-5", title: "First Non-Repeating Character", category: "Strings", difficulty: "medium", defaultLanguage: "c",
    description: "Given a string, find and print the first character that does not repeat. If all repeat, print '-1'.",
    inputFormat: "Single line: a string s",
    outputFormat: "Single character or '-1'",
    constraints: "1 ≤ |s| ≤ 10⁵\ns contains lowercase English letters.",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[100001];\n    scanf(\"%s\",s);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\n#include<string>\n#include<unordered_map>\nusing namespace std;\nint main(){\n    string s;\n    cin>>s;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.next();\n        // Your code here\n    }\n}", python: "s = input()\n# Your code here\n", javascript: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\n// Your code here\n" },
    testCases: [ { input: "aabbcdd", expectedOutput: "c", isHidden: false }, { input: "aabb", expectedOutput: "-1", isHidden: false }, { input: "abcabc", expectedOutput: "-1", isHidden: true } ],
    hints: ["Use a hash map to count frequencies.", "Then loop again to find first with count 1."],
    explanation: "In 'aabbcdd', only 'c' appears once.",
    tags: ["string", "hash-map", "frequency"]
  },
  // ═══ MATH (10 problems) ═══
  {
    id: "math-1", title: "Factorial", category: "Math", difficulty: "easy", defaultLanguage: "python",
    description: "Given a number N, print its factorial (N!).",
    inputFormat: "Single integer N",
    outputFormat: "Single integer - N!",
    constraints: "0 ≤ N ≤ 20",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\n# Your code here\n", javascript: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\n// Your code here\n" },
    testCases: [ { input: "5", expectedOutput: "120", isHidden: false }, { input: "0", expectedOutput: "1", isHidden: false }, { input: "10", expectedOutput: "3628800", isHidden: true } ],
    hints: ["Multiply from 1 to N.", "0! = 1 by definition."],
    explanation: "5! = 5 × 4 × 3 × 2 × 1 = 120",
    tags: ["math", "factorial", "iteration"]
  },
  {
    id: "math-2", title: "Fibonacci Nth Term", category: "Math", difficulty: "easy", defaultLanguage: "c",
    description: "Given N, print the Nth Fibonacci number (0-indexed: F(0)=0, F(1)=1, F(2)=1, F(3)=2...).",
    inputFormat: "Single integer N",
    outputFormat: "Single integer - Nth Fibonacci number",
    constraints: "0 ≤ N ≤ 30",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\n# Your code here\n", javascript: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\n// Your code here\n" },
    testCases: [ { input: "6", expectedOutput: "8", isHidden: false }, { input: "0", expectedOutput: "0", isHidden: false }, { input: "10", expectedOutput: "55", isHidden: true } ],
    hints: ["Use iterative approach with two variables.", "F(n) = F(n-1) + F(n-2)."],
    explanation: "F(6) = 0,1,1,2,3,5,8 so answer is 8.",
    tags: ["math", "fibonacci", "iteration"]
  },
  {
    id: "math-3", title: "Prime Check", category: "Math", difficulty: "easy", defaultLanguage: "c",
    description: "Given a number N, print 'Yes' if it is prime, otherwise 'No'.",
    inputFormat: "Single integer N",
    outputFormat: "'Yes' or 'No'",
    constraints: "1 ≤ N ≤ 10⁶",
    timeComplexity: "O(√n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\n# Your code here\n", javascript: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\n// Your code here\n" },
    testCases: [ { input: "7", expectedOutput: "Yes", isHidden: false }, { input: "4", expectedOutput: "No", isHidden: false }, { input: "1", expectedOutput: "No", isHidden: true } ],
    hints: ["Check divisibility up to sqrt(N).", "1 is not prime."],
    explanation: "7 is prime as it has no divisors except 1 and 7.",
    tags: ["math", "prime", "number-theory"]
  },
  {
    id: "math-4", title: "GCD of Two Numbers", category: "Math", difficulty: "easy", defaultLanguage: "c",
    description: "Given two numbers A and B, print their GCD (Greatest Common Divisor).",
    inputFormat: "Single line: two integers A and B (space-separated)",
    outputFormat: "Single integer - GCD of A and B",
    constraints: "1 ≤ A, B ≤ 10⁹",
    timeComplexity: "O(log(min(a,b)))", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int a,b;\n    scanf(\"%d%d\",&a,&b);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int a,b;\n    cin>>a>>b;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        // Your code here\n    }\n}", python: "a, b = map(int, input().split())\n# Your code here\n", javascript: "const [a, b] = require('fs').readFileSync('/dev/stdin','utf8').trim().split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "12 8", expectedOutput: "4", isHidden: false }, { input: "7 13", expectedOutput: "1", isHidden: true } ],
    hints: ["Use Euclidean algorithm: GCD(a,b) = GCD(b, a%b)."],
    explanation: "GCD(12,8) = GCD(8,4) = GCD(4,0) = 4",
    tags: ["math", "gcd", "euclidean"]
  },
  {
    id: "math-5", title: "Power of Two", category: "Math", difficulty: "easy", defaultLanguage: "python",
    description: "Given a number N, print 'Yes' if it is a power of 2, otherwise 'No'.",
    inputFormat: "Single integer N",
    outputFormat: "'Yes' or 'No'",
    constraints: "1 ≤ N ≤ 10⁹",
    timeComplexity: "O(1)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\n# Your code here\n", javascript: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\n// Your code here\n" },
    testCases: [ { input: "16", expectedOutput: "Yes", isHidden: false }, { input: "6", expectedOutput: "No", isHidden: false }, { input: "1", expectedOutput: "Yes", isHidden: true } ],
    hints: ["A power of 2 has only one bit set: n & (n-1) == 0.", "Also n must be > 0."],
    explanation: "16 = 2^4, so it's a power of 2.",
    tags: ["math", "bit-manipulation", "power-of-two"]
  },
  // ═══ SORTING (5 problems) ═══
  {
    id: "sort-1", title: "Bubble Sort", category: "Sorting", difficulty: "easy", defaultLanguage: "c",
    description: "Given an array of N integers, sort it in ascending order using any method. Print space-separated.",
    inputFormat: "First line: N (array size)\nSecond line: N space-separated integers",
    outputFormat: "N space-separated integers in ascending order",
    constraints: "1 ≤ N ≤ 10⁴\n-10⁹ ≤ arr[i] ≤ 10⁹",
    timeComplexity: "O(n²)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "5\n5 3 1 4 2", expectedOutput: "1 2 3 4 5", isHidden: false }, { input: "4\n4 3 2 1", expectedOutput: "1 2 3 4", isHidden: true } ],
    hints: ["Compare adjacent elements and swap if needed.", "Repeat until no swaps needed."],
    explanation: "Sort [5,3,1,4,2] to get [1,2,3,4,5].",
    tags: ["sorting", "bubble-sort", "array"]
  },
  {
    id: "sort-2", title: "Sort Even and Odd", category: "Sorting", difficulty: "medium", defaultLanguage: "python",
    description: "Given an array, print all even numbers sorted followed by all odd numbers sorted (space-separated).",
    inputFormat: "First line: N (array size)\nSecond line: N space-separated integers",
    outputFormat: "N space-separated integers (evens sorted + odds sorted)",
    constraints: "1 ≤ N ≤ 10⁵\n-10⁹ ≤ arr[i] ≤ 10⁹",
    timeComplexity: "O(n log n)", spaceComplexity: "O(n)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\n#include<vector>\n#include<algorithm>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "6\n5 2 8 1 4 3", expectedOutput: "2 4 8 1 3 5", isHidden: false }, { input: "4\n1 3 5 7", expectedOutput: "1 3 5 7", isHidden: true } ],
    hints: ["Separate evens and odds, sort each, then concatenate."],
    explanation: "From [5,2,8,1,4,3], evens=[2,4,8] odds=[1,3,5], result=[2,4,8,1,3,5].",
    tags: ["sorting", "array", "partition"]
  },
  // ═══ SEARCHING (5 problems) ═══
  {
    id: "search-1", title: "Binary Search", category: "Searching", difficulty: "easy", defaultLanguage: "c",
    description: "Given a sorted array of N integers and a target X, print the 0-based index of X. If not found, print -1.",
    inputFormat: "First line: N and X (space-separated)\nSecond line: N space-separated integers (sorted)",
    outputFormat: "Single integer - index of X or -1",
    constraints: "1 ≤ N ≤ 10⁵\n-10⁹ ≤ arr[i] ≤ 10⁹\nArray is sorted in ascending order.",
    timeComplexity: "O(log n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n,x;\n    scanf(\"%d%d\",&n,&x);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n,x;\n    cin>>n>>x;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int x = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n, x = map(int, input().split())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst [n, x] = lines[0].split(' ').map(Number);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "5 3\n1 2 3 4 5", expectedOutput: "2", isHidden: false }, { input: "4 6\n1 3 5 7", expectedOutput: "-1", isHidden: true } ],
    hints: ["Use low, high, mid pointers.", "Halve the search space each iteration."],
    explanation: "In [1,2,3,4,5], element 3 is at index 2.",
    tags: ["searching", "binary-search", "divide-conquer"]
  },
  {
    id: "search-2", title: "Count Occurrences", category: "Searching", difficulty: "easy", defaultLanguage: "python",
    description: "Given an array and a target X, count how many times X appears in the array.",
    inputFormat: "First line: N and X (space-separated)\nSecond line: N space-separated integers",
    outputFormat: "Single integer - count of X",
    constraints: "1 ≤ N ≤ 10⁵\n-10⁹ ≤ arr[i], X ≤ 10⁹",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n,x;\n    scanf(\"%d%d\",&n,&x);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n,x;\n    cin>>n>>x;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int x = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n, x = map(int, input().split())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst [n, x] = lines[0].split(' ').map(Number);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "6 3\n1 3 3 2 3 5", expectedOutput: "3", isHidden: false }, { input: "4 7\n1 2 3 4", expectedOutput: "0", isHidden: true } ],
    hints: ["Loop through and count matches."],
    explanation: "In [1,3,3,2,3,5], element 3 appears 3 times.",
    tags: ["searching", "counting", "linear-search"]
  },
  // ═══ RECURSION (5 problems) ═══
  {
    id: "rec-1", title: "Sum of Digits", category: "Recursion", difficulty: "easy", defaultLanguage: "python",
    description: "Given a positive integer N, print the sum of its digits using recursion.",
    inputFormat: "Single integer N",
    outputFormat: "Single integer - sum of digits",
    constraints: "1 ≤ N ≤ 10⁹",
    timeComplexity: "O(log n)", spaceComplexity: "O(log n)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\n# Your code here (use recursion)\n", javascript: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\n// Your code here\n" },
    testCases: [ { input: "123", expectedOutput: "6", isHidden: false }, { input: "9999", expectedOutput: "36", isHidden: true } ],
    hints: ["Base case: n < 10 return n.", "Recursive: n%10 + sumDigits(n/10)."],
    explanation: "For 123: 1+2+3 = 6",
    tags: ["recursion", "math", "digits"]
  },
  {
    id: "rec-2", title: "Power (x^n)", category: "Recursion", difficulty: "medium", defaultLanguage: "c",
    description: "Given base X and exponent N (non-negative integer), calculate X^N using recursion. Print the result.",
    inputFormat: "Single line: two integers X (base) and N (exponent) space-separated",
    outputFormat: "Single integer - X raised to the power N",
    constraints: "1 ≤ X ≤ 10\n0 ≤ N ≤ 30",
    timeComplexity: "O(log n)", spaceComplexity: "O(log n)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int x,n;\n    scanf(\"%d%d\",&x,&n);\n    // Your code here (use recursion)\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int x,n;\n    cin>>x>>n;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int x = sc.nextInt();\n        int n = sc.nextInt();\n        // Your code here (use recursion)\n    }\n}", python: "x, n = map(int, input().split())\n# Your code here (use recursion)\n", javascript: "const [x, n] = require('fs').readFileSync('/dev/stdin','utf8').trim().split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "2 10", expectedOutput: "1024", isHidden: false }, { input: "3 0", expectedOutput: "1", isHidden: false }, { input: "5 3", expectedOutput: "125", isHidden: true } ],
    hints: ["Base case: n==0 return 1.", "Optimize: if n is even, pow(x*x, n/2)."],
    explanation: "2^10 = 1024. For n=0, any number raised to 0 is 1.",
    tags: ["recursion", "math", "power", "divide-conquer"]
  },
  // ═══ LINKED LIST (5 problems) ═══
  {
    id: "ll-1", title: "Print Linked List", category: "Linked List", difficulty: "easy", defaultLanguage: "c",
    description: "Given N elements, create a linked list and print all elements space-separated.",
    inputFormat: "First line: N (number of elements)\nSecond line: N space-separated integers",
    outputFormat: "N space-separated integers in order",
    constraints: "1 ≤ N ≤ 10⁴\n-10⁹ ≤ elements ≤ 10⁹",
    timeComplexity: "O(n)", spaceComplexity: "O(n)",
    starterCode: { c: "#include<stdio.h>\n#include<stdlib.h>\nstruct Node { int data; struct Node* next; };\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    // Create linked list and print\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nstruct Node { int data; Node* next; };\nint main(){\n    int n;\n    cin>>n;\n    // Create linked list and print\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    static class Node { int data; Node next; Node(int d){data=d;next=null;} }\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Create linked list and print\n    }\n}", python: "n = int(input())\narr = list(map(int, input().split()))\n# Simulate linked list and print\nprint(' '.join(map(str, arr)))\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "5\n1 2 3 4 5", expectedOutput: "1 2 3 4 5", isHidden: false }, { input: "3\n10 20 30", expectedOutput: "10 20 30", isHidden: true } ],
    hints: ["Create nodes and link them.", "Traverse from head to null."],
    explanation: "Create a linked list from [1,2,3,4,5] and print each node's data.",
    tags: ["linked-list", "traversal", "data-structure"]
  },
  // ═══ STACK & QUEUE (5 problems) ═══
  {
    id: "sq-1", title: "Valid Parentheses", category: "Stack & Queue", difficulty: "medium", defaultLanguage: "c",
    description: "Given a string containing only '(', ')', '{', '}', '[', ']', print 'Yes' if valid, 'No' otherwise.",
    inputFormat: "Single line: a string s containing only bracket characters",
    outputFormat: "'Yes' if brackets are valid, 'No' otherwise",
    constraints: "1 ≤ |s| ≤ 10⁴\ns contains only bracket characters.",
    timeComplexity: "O(n)", spaceComplexity: "O(n)",
    starterCode: { c: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[10001];\n    scanf(\"%s\",s);\n    // Your code here (use array as stack)\n    return 0;\n}", cpp: "#include<iostream>\n#include<stack>\n#include<string>\nusing namespace std;\nint main(){\n    string s;\n    cin>>s;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.next();\n        // Your code here (use Stack)\n    }\n}", python: "s = input()\n# Your code here\n", javascript: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\n// Your code here\n" },
    testCases: [ { input: "()[]{}", expectedOutput: "Yes", isHidden: false }, { input: "(]", expectedOutput: "No", isHidden: false }, { input: "({[]})", expectedOutput: "Yes", isHidden: true } ],
    hints: ["Use a stack.", "Push opening brackets, pop and match for closing."],
    explanation: "'()[]{}' — each opening bracket matches its closing bracket in correct order.",
    tags: ["stack", "string", "parentheses", "matching"]
  },
  {
    id: "sq-2", title: "Reverse String using Stack", category: "Stack & Queue", difficulty: "easy", defaultLanguage: "c",
    description: "Given a string, reverse it using a stack and print the result.",
    inputFormat: "Single line: a string s",
    outputFormat: "The reversed string",
    constraints: "1 ≤ |s| ≤ 10⁵\ns contains lowercase English letters.",
    timeComplexity: "O(n)", spaceComplexity: "O(n)",
    starterCode: { c: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[100001];\n    scanf(\"%s\",s);\n    // Use char array as stack to reverse\n    return 0;\n}", cpp: "#include<iostream>\n#include<stack>\n#include<string>\nusing namespace std;\nint main(){\n    string s;\n    cin>>s;\n    // Use stack to reverse\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        String s = sc.next();\n        // Use Stack to reverse\n    }\n}", python: "s = input()\n# Use stack (list) to reverse\n", javascript: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\n// Your code here\n" },
    testCases: [ { input: "hello", expectedOutput: "olleh", isHidden: false }, { input: "stack", expectedOutput: "kcats", isHidden: true } ],
    hints: ["Push all characters to stack.", "Pop one by one to build reversed string."],
    explanation: "Push 'hello' onto stack, then pop: 'o','l','l','e','h' → 'olleh'.",
    tags: ["stack", "string", "reverse"]
  },
  // ═══ TREES (3 problems) ═══
  {
    id: "tree-1", title: "Sum of Binary Tree Nodes", category: "Trees", difficulty: "medium", defaultLanguage: "python",
    description: "Given N nodes of a binary tree in level-order (-1 means null), print the sum of all non-null node values.",
    inputFormat: "First line: N (total nodes including nulls)\nSecond line: N space-separated integers (-1 represents null)",
    outputFormat: "Single integer - sum of all non-null values",
    constraints: "1 ≤ N ≤ 10⁴\n-10³ ≤ node values ≤ 10³\n-1 represents null.",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int sum=0,x;\n    for(int i=0;i<n;i++){\n        scanf(\"%d\",&x);\n        if(x!=-1) sum+=x;\n    }\n    printf(\"%d\",sum);\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    int sum=0;\n    for(int i=0;i<n;i++){\n        int x; cin>>x;\n        if(x!=-1) sum+=x;\n    }\n    cout<<sum;\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int sum = 0;\n        for(int i=0;i<n;i++){\n            int x = sc.nextInt();\n            if(x != -1) sum += x;\n        }\n        System.out.println(sum);\n    }\n}", python: "n = int(input())\nnodes = list(map(int, input().split()))\n# Sum all non-null nodes (-1 = null)\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst nodes = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "7\n1 2 3 -1 -1 4 5", expectedOutput: "15", isHidden: false }, { input: "3\n10 20 30", expectedOutput: "60", isHidden: true } ],
    hints: ["Simply sum all values that are not -1."],
    explanation: "Tree nodes [1,2,3,-1,-1,4,5]: sum = 1+2+3+4+5 = 15 (ignoring -1 nulls).",
    tags: ["tree", "traversal", "binary-tree", "sum"]
  },
  // ═══ DYNAMIC PROGRAMMING (5 problems) ═══
  {
    id: "dp-1", title: "Climbing Stairs", category: "Dynamic Programming", difficulty: "easy", defaultLanguage: "python",
    description: "You can climb 1 or 2 stairs at a time. Given N stairs, print the number of distinct ways to reach the top.",
    inputFormat: "Single integer N (number of stairs)",
    outputFormat: "Single integer - number of distinct ways to climb N stairs",
    constraints: "1 ≤ N ≤ 45",
    timeComplexity: "O(n)", spaceComplexity: "O(1)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\n# Your code here\n", javascript: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\n// Your code here\n" },
    testCases: [ { input: "4", expectedOutput: "5", isHidden: false }, { input: "1", expectedOutput: "1", isHidden: false }, { input: "6", expectedOutput: "13", isHidden: true } ],
    hints: ["dp[i] = dp[i-1] + dp[i-2].", "Same as Fibonacci pattern."],
    explanation: "For N=4, ways are: (1+1+1+1),(1+1+2),(1+2+1),(2+1+1),(2+2) = 5 ways.",
    tags: ["dynamic-programming", "fibonacci", "memoization"]
  },
  {
    id: "dp-2", title: "Coin Change (Min Coins)", category: "Dynamic Programming", difficulty: "hard", defaultLanguage: "c",
    description: "Given N coin denominations and a target amount, print the minimum number of coins needed. If not possible, print -1.",
    inputFormat: "First line: N (denominations count) and amount (target) space-separated\nSecond line: N space-separated coin values",
    outputFormat: "Single integer - minimum coins needed or -1 if impossible",
    constraints: "1 ≤ N ≤ 12\n1 ≤ amount ≤ 10⁴\n1 ≤ coins[i] ≤ amount",
    timeComplexity: "O(n × amount)", spaceComplexity: "O(amount)",
    starterCode: { c: "#include<stdio.h>\n#include<limits.h>\nint main(){\n    int n,amount;\n    scanf(\"%d%d\",&n,&amount);\n    int coins[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&coins[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\n#include<vector>\n#include<climits>\nusing namespace std;\nint main(){\n    int n,amount;\n    cin>>n>>amount;\n    int coins[n];\n    for(int i=0;i<n;i++) cin>>coins[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int amount = sc.nextInt();\n        int[] coins = new int[n];\n        for(int i=0;i<n;i++) coins[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n, amount = map(int, input().split())\ncoins = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst [n, amount] = lines[0].split(' ').map(Number);\nconst coins = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "3 11\n1 5 6", expectedOutput: "2", isHidden: false }, { input: "2 3\n2 5", expectedOutput: "-1", isHidden: false }, { input: "3 0\n1 2 5", expectedOutput: "0", isHidden: true } ],
    hints: ["Use DP array of size amount+1.", "dp[i] = min(dp[i], dp[i-coin]+1) for each coin."],
    explanation: "For amount=11, coins=[1,5,6]: use 6+5=11, so 2 coins minimum.",
    tags: ["dynamic-programming", "coin-change", "greedy", "dp"]
  },
  {
    id: "dp-3", title: "Longest Increasing Subsequence", category: "Dynamic Programming", difficulty: "hard", defaultLanguage: "c",
    description: "Given an array of N integers, find the length of the longest strictly increasing subsequence.",
    inputFormat: "First line: N (array size)\nSecond line: N space-separated integers",
    outputFormat: "Single integer - length of LIS",
    constraints: "1 ≤ N ≤ 2500\n-10⁴ ≤ arr[i] ≤ 10⁴",
    timeComplexity: "O(n²)", spaceComplexity: "O(n)",
    starterCode: { c: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    // Your code here\n    return 0;\n}", cpp: "#include<iostream>\n#include<vector>\nusing namespace std;\nint main(){\n    int n;\n    cin>>n;\n    int arr[n];\n    for(int i=0;i<n;i++) cin>>arr[i];\n    // Your code here\n    return 0;\n}", java: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i] = sc.nextInt();\n        // Your code here\n    }\n}", python: "n = int(input())\narr = list(map(int, input().split()))\n# Your code here\n", javascript: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst n = parseInt(lines[0]);\nconst arr = lines[1].split(' ').map(Number);\n// Your code here\n" },
    testCases: [ { input: "6\n10 9 2 5 3 7", expectedOutput: "3", isHidden: false }, { input: "8\n0 1 0 3 2 3 4 5", expectedOutput: "6", isHidden: true } ],
    hints: ["O(n^2): dp[i] = max(dp[j]+1) for j<i where arr[j]<arr[i].", "O(n log n): use patience sorting with binary search."],
    explanation: "For [10,9,2,5,3,7]: LIS is [2,3,7] or [2,5,7] = length 3.",
    tags: ["dynamic-programming", "lis", "subsequence", "binary-search"]
  },
];
