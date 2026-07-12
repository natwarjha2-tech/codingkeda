/**
 * SAFE Script — Add best solutions for problems that don't have one
 * ONLY UPDATES bestSolution field from NULL → solution data
 * Does NOT delete/modify any other data
 * 
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-solutions.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Adding best solutions for problems without one...");
  console.log("⚠️  ONLY updates NULL bestSolution fields. No data loss.\n");

  // Find exercises with NULL bestSolution
  const exercises = await prisma.exercise.findMany({
    where: { 
      type: "coding",
      bestSolution: { equals: Prisma.DbNull },
      lesson: { title: "Coding Practice Problems" }
    },
    select: { id: true, title: true, order: true },
    orderBy: { order: "asc" },
  });

  console.log(`📋 Found ${exercises.length} problems without solutions.\n`);

  if (exercises.length === 0) {
    console.log("✅ All problems already have solutions!");
    return;
  }

  let updated = 0;
  for (const ex of exercises) {
    const solution = SOLUTIONS[ex.title];
    if (!solution) {
      console.log(`  ⚠️  No manual solution for: ${ex.title} — skipping`);
      continue;
    }

    await prisma.exercise.update({
      where: { id: ex.id },
      data: { bestSolution: solution as any },
    });

    updated++;
    console.log(`  ✅ [${updated}] ${ex.title}`);
  }

  console.log(`\n🎉 Done! Updated: ${updated}`);
}

// Solutions for all problems (4 languages each)
const SOLUTIONS: Record<string, any> = {
  "Second Largest": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    int max1=-2147483648, max2=-2147483648;\n    for(int i=0;i<n;i++){\n        if(arr[i]>max1){ max2=max1; max1=arr[i]; }\n        else if(arr[i]>max2 && arr[i]!=max1) max2=arr[i];\n    }\n    printf(\"%d\", max2==-2147483648 ? -1 : max2);\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Track largest and second largest in one pass." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int max1 = Integer.MIN_VALUE, max2 = Integer.MIN_VALUE;\n        for(int i=0;i<n;i++){\n            int x = sc.nextInt();\n            if(x>max1){ max2=max1; max1=x; }\n            else if(x>max2 && x!=max1) max2=x;\n        }\n        System.out.println(max2==Integer.MIN_VALUE ? -1 : max2);\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Track largest and second largest in one pass." },
    python: { code: "n = int(input())\narr = list(map(int, input().split()))\nfirst = second = float('-inf')\nfor x in arr:\n    if x > first:\n        second = first\n        first = x\n    elif x > second and x != first:\n        second = x\nprint(-1 if second == float('-inf') else second)", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Track largest and second largest in one pass." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst arr = lines[1].split(' ').map(Number);\nlet max1 = -Infinity, max2 = -Infinity;\nfor(const x of arr){\n    if(x>max1){ max2=max1; max1=x; }\n    else if(x>max2 && x!==max1) max2=x;\n}\nconsole.log(max2===-Infinity ? -1 : max2);", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Track largest and second largest in one pass." }
  },
  "Move Zeros to End": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    int pos=0;\n    for(int i=0;i<n;i++) if(arr[i]!=0) arr[pos++]=arr[i];\n    while(pos<n) arr[pos++]=0;\n    for(int i=0;i<n;i++) printf(\"%d%s\",arr[i],i<n-1?\" \":\"\");\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Move non-zeros to front, fill rest with zeros." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i]=sc.nextInt();\n        int pos=0;\n        for(int i=0;i<n;i++) if(arr[i]!=0) arr[pos++]=arr[i];\n        while(pos<n) arr[pos++]=0;\n        StringBuilder sb = new StringBuilder();\n        for(int i=0;i<n;i++) sb.append(arr[i]).append(i<n-1?\" \":\"\");\n        System.out.println(sb);\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Move non-zeros to front, fill rest with zeros." },
    python: { code: "n = int(input())\narr = list(map(int, input().split()))\npos = 0\nfor i in range(n):\n    if arr[i] != 0:\n        arr[pos] = arr[i]\n        pos += 1\nwhile pos < n:\n    arr[pos] = 0\n    pos += 1\nprint(' '.join(map(str, arr)))", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Move non-zeros to front, fill rest with zeros." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst arr = lines[1].split(' ').map(Number);\nlet pos=0;\nfor(let i=0;i<arr.length;i++) if(arr[i]!==0) arr[pos++]=arr[i];\nwhile(pos<arr.length) arr[pos++]=0;\nconsole.log(arr.join(' '));", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Move non-zeros to front, fill rest with zeros." }
  },
  "Rotate Array Left": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n,k;\n    scanf(\"%d%d\",&n,&k);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    k=k%n;\n    for(int i=k;i<n;i++) printf(\"%d \",arr[i]);\n    for(int i=0;i<k;i++) printf(\"%d%s\",arr[i],i<k-1?\" \":\"\");\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Print from index k to end, then 0 to k-1." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n=sc.nextInt(), k=sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i]=sc.nextInt();\n        k=k%n;\n        StringBuilder sb = new StringBuilder();\n        for(int i=k;i<n;i++) sb.append(arr[i]).append(' ');\n        for(int i=0;i<k;i++) sb.append(arr[i]).append(i<k-1?' ':' ');\n        System.out.println(sb.toString().trim());\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Print from index k to end, then 0 to k-1." },
    python: { code: "n, k = map(int, input().split())\narr = list(map(int, input().split()))\nk = k % n\nprint(' '.join(map(str, arr[k:] + arr[:k])))", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Slice from k to end + start to k." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst [n,k] = lines[0].split(' ').map(Number);\nconst arr = lines[1].split(' ').map(Number);\nconst r = k%n;\nconsole.log([...arr.slice(r), ...arr.slice(0,r)].join(' '));", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Slice from k to end + start to k." }
  },
  "Merge Two Sorted Arrays": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n,m;\n    scanf(\"%d%d\",&n,&m);\n    int a[n],b[m];\n    for(int i=0;i<n;i++) scanf(\"%d\",&a[i]);\n    for(int i=0;i<m;i++) scanf(\"%d\",&b[i]);\n    int i=0,j=0;\n    while(i<n&&j<m){\n        if(a[i]<=b[j]) printf(\"%d \",a[i++]);\n        else printf(\"%d \",b[j++]);\n    }\n    while(i<n) printf(\"%d \",a[i++]);\n    while(j<m) printf(\"%d \",b[j++]);\n    return 0;\n}", timeComplexity: "O(n+m)", spaceComplexity: "O(1)", explanation: "Two pointer merge — compare and pick smaller." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n=sc.nextInt(), m=sc.nextInt();\n        int[] a=new int[n], b=new int[m];\n        for(int i=0;i<n;i++) a[i]=sc.nextInt();\n        for(int i=0;i<m;i++) b[i]=sc.nextInt();\n        int i=0,j=0;\n        StringBuilder sb = new StringBuilder();\n        while(i<n&&j<m) sb.append(a[i]<=b[j]?a[i++]:b[j++]).append(' ');\n        while(i<n) sb.append(a[i++]).append(' ');\n        while(j<m) sb.append(b[j++]).append(' ');\n        System.out.println(sb.toString().trim());\n    }\n}", timeComplexity: "O(n+m)", spaceComplexity: "O(n+m)", explanation: "Two pointer merge — compare and pick smaller." },
    python: { code: "n, m = map(int, input().split())\na = list(map(int, input().split()))\nb = list(map(int, input().split()))\ni = j = 0\nres = []\nwhile i<n and j<m:\n    if a[i]<=b[j]: res.append(a[i]); i+=1\n    else: res.append(b[j]); j+=1\nres.extend(a[i:])\nres.extend(b[j:])\nprint(' '.join(map(str, res)))", timeComplexity: "O(n+m)", spaceComplexity: "O(n+m)", explanation: "Two pointer merge — compare and pick smaller." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst a = lines[1].split(' ').map(Number);\nconst b = lines[2].split(' ').map(Number);\nlet i=0,j=0,res=[];\nwhile(i<a.length&&j<b.length) res.push(a[i]<=b[j]?a[i++]:b[j++]);\nwhile(i<a.length) res.push(a[i++]);\nwhile(j<b.length) res.push(b[j++]);\nconsole.log(res.join(' '));", timeComplexity: "O(n+m)", spaceComplexity: "O(n+m)", explanation: "Two pointer merge — compare and pick smaller." }
  },
  "Reverse String": {
    c: { code: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[100001];\n    scanf(\"%s\",s);\n    int n=strlen(s);\n    for(int i=n-1;i>=0;i--) printf(\"%c\",s[i]);\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Print characters from end to start." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        String s = new Scanner(System.in).next();\n        System.out.println(new StringBuilder(s).reverse());\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Use StringBuilder reverse." },
    python: { code: "s = input()\nprint(s[::-1])", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Python slicing to reverse." },
    javascript: { code: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\nconsole.log(s.split('').reverse().join(''));", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Split, reverse, join." }
  },
  "Palindrome Check": {
    c: { code: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[100001];\n    scanf(\"%s\",s);\n    int n=strlen(s), ok=1;\n    for(int i=0;i<n/2;i++) if(s[i]!=s[n-1-i]){ok=0;break;}\n    printf(ok?\"Yes\":\"No\");\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Compare first half with reversed second half." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        String s = new Scanner(System.in).next();\n        System.out.println(s.equals(new StringBuilder(s).reverse().toString())?\"Yes\":\"No\");\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Compare string with its reverse." },
    python: { code: "s = input()\nprint('Yes' if s == s[::-1] else 'No')", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Compare string with its reverse." },
    javascript: { code: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\nconsole.log(s===s.split('').reverse().join('')?'Yes':'No');", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Compare string with its reverse." }
  },
  "Count Vowels": {
    c: { code: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[100001];\n    fgets(s,100001,stdin);\n    int count=0;\n    for(int i=0;s[i];i++){\n        char c=s[i];\n        if(c=='a'||c=='e'||c=='i'||c=='o'||c=='u'||c=='A'||c=='E'||c=='I'||c=='O'||c=='U') count++;\n    }\n    printf(\"%d\",count);\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Loop through each character and check if vowel." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        String s = new Scanner(System.in).nextLine();\n        int count = 0;\n        for(char c : s.toCharArray()) if(\"aeiouAEIOU\".indexOf(c)!=-1) count++;\n        System.out.println(count);\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Check each character against vowel set." },
    python: { code: "s = input()\nprint(sum(1 for c in s if c in 'aeiouAEIOU'))", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Count characters that are vowels." },
    javascript: { code: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\nconsole.log((s.match(/[aeiou]/gi)||[]).length);", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Regex match all vowels and count." }
  },
  "Anagram Check": {
    c: { code: "#include<stdio.h>\n#include<string.h>\n#include<ctype.h>\nint main(){\n    char a[100001],b[100001];\n    scanf(\"%s%s\",a,b);\n    int freq[26]={0};\n    for(int i=0;a[i];i++) freq[tolower(a[i])-'a']++;\n    for(int i=0;b[i];i++) freq[tolower(b[i])-'a']--;\n    int ok=1;\n    for(int i=0;i<26;i++) if(freq[i]!=0){ok=0;break;}\n    printf(ok?\"Yes\":\"No\");\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Count character frequencies and compare." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        char[] a = sc.next().toLowerCase().toCharArray();\n        char[] b = sc.next().toLowerCase().toCharArray();\n        Arrays.sort(a); Arrays.sort(b);\n        System.out.println(Arrays.equals(a,b)?\"Yes\":\"No\");\n    }\n}", timeComplexity: "O(n log n)", spaceComplexity: "O(n)", explanation: "Sort both and compare." },
    python: { code: "a = input().lower()\nb = input().lower()\nprint('Yes' if sorted(a)==sorted(b) else 'No')", timeComplexity: "O(n log n)", spaceComplexity: "O(n)", explanation: "Sort both and compare." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst a = lines[0].toLowerCase().split('').sort().join('');\nconst b = lines[1].toLowerCase().split('').sort().join('');\nconsole.log(a===b?'Yes':'No');", timeComplexity: "O(n log n)", spaceComplexity: "O(n)", explanation: "Sort both and compare." }
  },
  "First Non-Repeating Character": {
    c: { code: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[100001];\n    scanf(\"%s\",s);\n    int freq[26]={0};\n    for(int i=0;s[i];i++) freq[s[i]-'a']++;\n    for(int i=0;s[i];i++) if(freq[s[i]-'a']==1){printf(\"%c\",s[i]);return 0;}\n    printf(\"-1\");\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Count frequencies, then find first with count 1." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        String s = new Scanner(System.in).next();\n        int[] freq = new int[26];\n        for(char c:s.toCharArray()) freq[c-'a']++;\n        for(char c:s.toCharArray()) if(freq[c-'a']==1){System.out.println(c);return;}\n        System.out.println(-1);\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Count frequencies, find first with count 1." },
    python: { code: "s = input()\nfrom collections import Counter\nc = Counter(s)\nfor ch in s:\n    if c[ch]==1: print(ch); break\nelse: print(-1)", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Count frequencies, find first with count 1." },
    javascript: { code: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\nconst freq = {};\nfor(const c of s) freq[c]=(freq[c]||0)+1;\nlet ans='-1';\nfor(const c of s) if(freq[c]===1){ans=c;break;}\nconsole.log(ans);", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Count frequencies, find first with count 1." }
  },
  "Factorial": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    long long f=1;\n    for(int i=2;i<=n;i++) f*=i;\n    printf(\"%lld\",f);\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Multiply 1 to n iteratively." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        int n = new Scanner(System.in).nextInt();\n        long f = 1;\n        for(int i=2;i<=n;i++) f*=i;\n        System.out.println(f);\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Multiply 1 to n iteratively." },
    python: { code: "n = int(input())\nresult = 1\nfor i in range(2, n+1):\n    result *= i\nprint(result)", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Multiply 1 to n iteratively." },
    javascript: { code: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\nlet f=1;\nfor(let i=2;i<=n;i++) f*=i;\nconsole.log(f);", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Multiply 1 to n iteratively." }
  },
  "Fibonacci Nth Term": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    if(n<=1){printf(\"%d\",n);return 0;}\n    int a=0,b=1,c;\n    for(int i=2;i<=n;i++){c=a+b;a=b;b=c;}\n    printf(\"%d\",b);\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Iterative with two variables." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        int n = new Scanner(System.in).nextInt();\n        if(n<=1){System.out.println(n);return;}\n        int a=0,b=1;\n        for(int i=2;i<=n;i++){int c=a+b;a=b;b=c;}\n        System.out.println(b);\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Iterative with two variables." },
    python: { code: "n = int(input())\nif n <= 1:\n    print(n)\nelse:\n    a, b = 0, 1\n    for _ in range(2, n+1):\n        a, b = b, a+b\n    print(b)", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Iterative with two variables." },
    javascript: { code: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\nif(n<=1){console.log(n);}else{let a=0,b=1;for(let i=2;i<=n;i++){[a,b]=[b,a+b];}console.log(b);}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Iterative with two variables." }
  },
  "Prime Check": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    if(n<2){printf(\"No\");return 0;}\n    for(int i=2;i*i<=n;i++) if(n%i==0){printf(\"No\");return 0;}\n    printf(\"Yes\");\n    return 0;\n}", timeComplexity: "O(sqrt(n))", spaceComplexity: "O(1)", explanation: "Check divisibility up to sqrt(n)." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        int n = new Scanner(System.in).nextInt();\n        if(n<2){System.out.println(\"No\");return;}\n        for(int i=2;i*i<=n;i++) if(n%i==0){System.out.println(\"No\");return;}\n        System.out.println(\"Yes\");\n    }\n}", timeComplexity: "O(sqrt(n))", spaceComplexity: "O(1)", explanation: "Check divisibility up to sqrt(n)." },
    python: { code: "n = int(input())\nif n < 2:\n    print('No')\nelse:\n    i = 2\n    while i*i <= n:\n        if n%i == 0:\n            print('No')\n            break\n        i += 1\n    else:\n        print('Yes')", timeComplexity: "O(sqrt(n))", spaceComplexity: "O(1)", explanation: "Check divisibility up to sqrt(n)." },
    javascript: { code: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\nif(n<2){console.log('No');}else{let ok=true;for(let i=2;i*i<=n;i++)if(n%i===0){ok=false;break;}console.log(ok?'Yes':'No');}", timeComplexity: "O(sqrt(n))", spaceComplexity: "O(1)", explanation: "Check divisibility up to sqrt(n)." }
  },
  "GCD of Two Numbers": {
    c: { code: "#include<stdio.h>\nint gcd(int a,int b){return b==0?a:gcd(b,a%b);}\nint main(){\n    int a,b;\n    scanf(\"%d%d\",&a,&b);\n    printf(\"%d\",gcd(a,b));\n    return 0;\n}", timeComplexity: "O(log(min(a,b)))", spaceComplexity: "O(1)", explanation: "Euclidean algorithm." },
    java: { code: "import java.util.*;\npublic class Main {\n    static int gcd(int a,int b){return b==0?a:gcd(b,a%b);}\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.println(gcd(sc.nextInt(),sc.nextInt()));\n    }\n}", timeComplexity: "O(log(min(a,b)))", spaceComplexity: "O(1)", explanation: "Euclidean algorithm." },
    python: { code: "a, b = map(int, input().split())\nwhile b:\n    a, b = b, a%b\nprint(a)", timeComplexity: "O(log(min(a,b)))", spaceComplexity: "O(1)", explanation: "Euclidean algorithm." },
    javascript: { code: "const [a,b] = require('fs').readFileSync('/dev/stdin','utf8').trim().split(' ').map(Number);\nfunction gcd(a,b){return b===0?a:gcd(b,a%b);}\nconsole.log(gcd(a,b));", timeComplexity: "O(log(min(a,b)))", spaceComplexity: "O(1)", explanation: "Euclidean algorithm." }
  },
  "Power of Two": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    printf(n>0&&(n&(n-1))==0?\"Yes\":\"No\");\n    return 0;\n}", timeComplexity: "O(1)", spaceComplexity: "O(1)", explanation: "Bit trick: power of 2 has single bit set." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        int n = new Scanner(System.in).nextInt();\n        System.out.println(n>0&&(n&(n-1))==0?\"Yes\":\"No\");\n    }\n}", timeComplexity: "O(1)", spaceComplexity: "O(1)", explanation: "Bit trick: power of 2 has single bit set." },
    python: { code: "n = int(input())\nprint('Yes' if n>0 and (n&(n-1))==0 else 'No')", timeComplexity: "O(1)", spaceComplexity: "O(1)", explanation: "Bit trick: power of 2 has single bit set." },
    javascript: { code: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\nconsole.log(n>0&&(n&(n-1))===0?'Yes':'No');", timeComplexity: "O(1)", spaceComplexity: "O(1)", explanation: "Bit trick: power of 2 has single bit set." }
  },
  "Bubble Sort": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    for(int i=0;i<n-1;i++)\n        for(int j=0;j<n-i-1;j++)\n            if(arr[j]>arr[j+1]){int t=arr[j];arr[j]=arr[j+1];arr[j+1]=t;}\n    for(int i=0;i<n;i++) printf(\"%d%s\",arr[i],i<n-1?\" \":\"\");\n    return 0;\n}", timeComplexity: "O(n²)", spaceComplexity: "O(1)", explanation: "Compare adjacent elements and swap." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i]=sc.nextInt();\n        Arrays.sort(arr);\n        StringBuilder sb = new StringBuilder();\n        for(int i=0;i<n;i++) sb.append(arr[i]).append(i<n-1?\" \":\"\");\n        System.out.println(sb);\n    }\n}", timeComplexity: "O(n log n)", spaceComplexity: "O(1)", explanation: "Use built-in sort for efficiency." },
    python: { code: "n = int(input())\narr = list(map(int, input().split()))\narr.sort()\nprint(' '.join(map(str, arr)))", timeComplexity: "O(n log n)", spaceComplexity: "O(1)", explanation: "Use built-in sort." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst arr = lines[1].split(' ').map(Number);\narr.sort((a,b)=>a-b);\nconsole.log(arr.join(' '));", timeComplexity: "O(n log n)", spaceComplexity: "O(1)", explanation: "Use built-in sort." }
  },
  "Sort Even and Odd": {
    c: { code: "#include<stdio.h>\n#include<stdlib.h>\nint cmp(const void*a,const void*b){return *(int*)a-*(int*)b;}\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n],evens[n],odds[n],ec=0,oc=0;\n    for(int i=0;i<n;i++){scanf(\"%d\",&arr[i]);if(arr[i]%2==0)evens[ec++]=arr[i];else odds[oc++]=arr[i];}\n    qsort(evens,ec,sizeof(int),cmp);\n    qsort(odds,oc,sizeof(int),cmp);\n    for(int i=0;i<ec;i++) printf(\"%d \",evens[i]);\n    for(int i=0;i<oc;i++) printf(\"%d%s\",odds[i],i<oc-1?\" \":\"\");\n    return 0;\n}", timeComplexity: "O(n log n)", spaceComplexity: "O(n)", explanation: "Separate, sort each, concatenate." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        List<Integer> evens=new ArrayList<>(), odds=new ArrayList<>();\n        for(int i=0;i<n;i++){int x=sc.nextInt();if(x%2==0)evens.add(x);else odds.add(x);}\n        Collections.sort(evens); Collections.sort(odds);\n        StringBuilder sb = new StringBuilder();\n        for(int x:evens) sb.append(x).append(' ');\n        for(int x:odds) sb.append(x).append(' ');\n        System.out.println(sb.toString().trim());\n    }\n}", timeComplexity: "O(n log n)", spaceComplexity: "O(n)", explanation: "Separate, sort each, concatenate." },
    python: { code: "n = int(input())\narr = list(map(int, input().split()))\nevens = sorted(x for x in arr if x%2==0)\nodds = sorted(x for x in arr if x%2!=0)\nprint(' '.join(map(str, evens+odds)))", timeComplexity: "O(n log n)", spaceComplexity: "O(n)", explanation: "Separate, sort each, concatenate." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst arr = lines[1].split(' ').map(Number);\nconst evens = arr.filter(x=>x%2===0).sort((a,b)=>a-b);\nconst odds = arr.filter(x=>x%2!==0).sort((a,b)=>a-b);\nconsole.log([...evens,...odds].join(' '));", timeComplexity: "O(n log n)", spaceComplexity: "O(n)", explanation: "Filter, sort each, concatenate." }
  },
  "Binary Search": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n,x;\n    scanf(\"%d%d\",&n,&x);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    int lo=0,hi=n-1,ans=-1;\n    while(lo<=hi){\n        int mid=(lo+hi)/2;\n        if(arr[mid]==x){ans=mid;break;}\n        else if(arr[mid]<x) lo=mid+1;\n        else hi=mid-1;\n    }\n    printf(\"%d\",ans);\n    return 0;\n}", timeComplexity: "O(log n)", spaceComplexity: "O(1)", explanation: "Halve search space each step." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n=sc.nextInt(), x=sc.nextInt();\n        int[] arr = new int[n];\n        for(int i=0;i<n;i++) arr[i]=sc.nextInt();\n        int lo=0,hi=n-1,ans=-1;\n        while(lo<=hi){\n            int mid=(lo+hi)/2;\n            if(arr[mid]==x){ans=mid;break;}\n            else if(arr[mid]<x) lo=mid+1;\n            else hi=mid-1;\n        }\n        System.out.println(ans);\n    }\n}", timeComplexity: "O(log n)", spaceComplexity: "O(1)", explanation: "Halve search space each step." },
    python: { code: "n, x = map(int, input().split())\narr = list(map(int, input().split()))\nlo, hi = 0, n-1\nans = -1\nwhile lo <= hi:\n    mid = (lo+hi)//2\n    if arr[mid] == x: ans=mid; break\n    elif arr[mid] < x: lo=mid+1\n    else: hi=mid-1\nprint(ans)", timeComplexity: "O(log n)", spaceComplexity: "O(1)", explanation: "Halve search space each step." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst [n,x] = lines[0].split(' ').map(Number);\nconst arr = lines[1].split(' ').map(Number);\nlet lo=0,hi=n-1,ans=-1;\nwhile(lo<=hi){const mid=Math.floor((lo+hi)/2);if(arr[mid]===x){ans=mid;break;}else if(arr[mid]<x)lo=mid+1;else hi=mid-1;}\nconsole.log(ans);", timeComplexity: "O(log n)", spaceComplexity: "O(1)", explanation: "Halve search space each step." }
  },
  "Count Occurrences": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n,x;\n    scanf(\"%d%d\",&n,&x);\n    int arr[n],count=0;\n    for(int i=0;i<n;i++){scanf(\"%d\",&arr[i]);if(arr[i]==x)count++;}\n    printf(\"%d\",count);\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Loop and count matches." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n=sc.nextInt(), x=sc.nextInt(), count=0;\n        for(int i=0;i<n;i++) if(sc.nextInt()==x) count++;\n        System.out.println(count);\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Loop and count matches." },
    python: { code: "n, x = map(int, input().split())\narr = list(map(int, input().split()))\nprint(arr.count(x))", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Use built-in count." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst [n,x] = lines[0].split(' ').map(Number);\nconst arr = lines[1].split(' ').map(Number);\nconsole.log(arr.filter(a=>a===x).length);", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Filter and count." }
  },
  "Sum of Digits": {
    c: { code: "#include<stdio.h>\nint sumDigits(int n){return n<10?n:n%10+sumDigits(n/10);}\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    printf(\"%d\",sumDigits(n));\n    return 0;\n}", timeComplexity: "O(log n)", spaceComplexity: "O(log n)", explanation: "Recursive: last digit + sum of remaining." },
    java: { code: "import java.util.*;\npublic class Main {\n    static int sumDigits(int n){return n<10?n:n%10+sumDigits(n/10);}\n    public static void main(String[] args) {\n        System.out.println(sumDigits(new Scanner(System.in).nextInt()));\n    }\n}", timeComplexity: "O(log n)", spaceComplexity: "O(log n)", explanation: "Recursive: last digit + sum of remaining." },
    python: { code: "def sum_digits(n):\n    return n if n < 10 else n%10 + sum_digits(n//10)\nprint(sum_digits(int(input())))", timeComplexity: "O(log n)", spaceComplexity: "O(log n)", explanation: "Recursive: last digit + sum of remaining." },
    javascript: { code: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\nfunction sumDigits(n){return n<10?n:n%10+sumDigits(Math.floor(n/10));}\nconsole.log(sumDigits(n));", timeComplexity: "O(log n)", spaceComplexity: "O(log n)", explanation: "Recursive: last digit + sum of remaining." }
  },
  "Power (x^n)": {
    c: { code: "#include<stdio.h>\nlong long power(int x,int n){if(n==0)return 1;long long half=power(x,n/2);return n%2==0?half*half:half*half*x;}\nint main(){\n    int x,n;\n    scanf(\"%d%d\",&x,&n);\n    printf(\"%lld\",power(x,n));\n    return 0;\n}", timeComplexity: "O(log n)", spaceComplexity: "O(log n)", explanation: "Fast power: divide exponent by 2 each step." },
    java: { code: "import java.util.*;\npublic class Main {\n    static long power(int x,int n){if(n==0)return 1;long half=power(x,n/2);return n%2==0?half*half:half*half*x;}\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.println(power(sc.nextInt(),sc.nextInt()));\n    }\n}", timeComplexity: "O(log n)", spaceComplexity: "O(log n)", explanation: "Fast power: divide exponent by 2 each step." },
    python: { code: "x, n = map(int, input().split())\ndef power(x, n):\n    if n == 0: return 1\n    half = power(x, n//2)\n    return half*half if n%2==0 else half*half*x\nprint(power(x, n))", timeComplexity: "O(log n)", spaceComplexity: "O(log n)", explanation: "Fast power: divide exponent by 2 each step." },
    javascript: { code: "const [x,n] = require('fs').readFileSync('/dev/stdin','utf8').trim().split(' ').map(Number);\nfunction power(x,n){if(n===0)return 1;const half=power(x,Math.floor(n/2));return n%2===0?half*half:half*half*x;}\nconsole.log(power(x,n));", timeComplexity: "O(log n)", spaceComplexity: "O(log n)", explanation: "Fast power: divide exponent by 2 each step." }
  },
  "Print Linked List": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&arr[i]);\n    for(int i=0;i<n;i++) printf(\"%d%s\",arr[i],i<n-1?\" \":\"\");\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Read and print elements in order." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        StringBuilder sb = new StringBuilder();\n        for(int i=0;i<n;i++) sb.append(sc.nextInt()).append(i<n-1?\" \":\"\");\n        System.out.println(sb);\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Read and print elements in order." },
    python: { code: "n = int(input())\narr = list(map(int, input().split()))\nprint(' '.join(map(str, arr)))", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Read and print elements." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconsole.log(lines[1]);", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Read and print elements." }
  },
  "Valid Parentheses": {
    c: { code: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[10001];\n    scanf(\"%s\",s);\n    char stack[10001];\n    int top=-1;\n    for(int i=0;s[i];i++){\n        if(s[i]=='('||s[i]=='['||s[i]=='{') stack[++top]=s[i];\n        else{\n            if(top<0){printf(\"No\");return 0;}\n            char c=stack[top--];\n            if((s[i]==')'&&c!='(')||(s[i]==']'&&c!='[')||(s[i]=='}'&&c!='{')){\n                printf(\"No\");return 0;\n            }\n        }\n    }\n    printf(top==-1?\"Yes\":\"No\");\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Stack: push opens, pop and match closes." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        String s = new Scanner(System.in).next();\n        Stack<Character> st = new Stack<>();\n        for(char c:s.toCharArray()){\n            if(c=='('||c=='['||c=='{') st.push(c);\n            else{\n                if(st.isEmpty()){System.out.println(\"No\");return;}\n                char t=st.pop();\n                if((c==')'&&t!='(')||(c==']'&&t!='[')||(c=='}'&&t!='{')){\n                    System.out.println(\"No\");return;\n                }\n            }\n        }\n        System.out.println(st.isEmpty()?\"Yes\":\"No\");\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Stack: push opens, pop and match closes." },
    python: { code: "s = input()\nstack = []\nmatch = {')':'(',']':'[','}':'{'}\nvalid = True\nfor c in s:\n    if c in '([{': stack.append(c)\n    else:\n        if not stack or stack[-1]!=match[c]: valid=False; break\n        stack.pop()\nprint('Yes' if valid and not stack else 'No')", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Stack: push opens, pop and match closes." },
    javascript: { code: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\nconst stack=[];\nconst map={')':'(',']':'[','}':'{'};\nlet ok=true;\nfor(const c of s){if('([{'.includes(c))stack.push(c);else{if(!stack.length||stack.pop()!==map[c]){ok=false;break;}}}\nconsole.log(ok&&!stack.length?'Yes':'No');", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Stack: push opens, pop and match closes." }
  },
  "Reverse String using Stack": {
    c: { code: "#include<stdio.h>\n#include<string.h>\nint main(){\n    char s[100001];\n    scanf(\"%s\",s);\n    int n=strlen(s);\n    for(int i=n-1;i>=0;i--) printf(\"%c\",s[i]);\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Print from end using array as stack." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        String s = new Scanner(System.in).next();\n        Stack<Character> st = new Stack<>();\n        for(char c:s.toCharArray()) st.push(c);\n        StringBuilder sb = new StringBuilder();\n        while(!st.isEmpty()) sb.append(st.pop());\n        System.out.println(sb);\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Push all chars, then pop to reverse." },
    python: { code: "s = input()\nstack = list(s)\nresult = ''\nwhile stack:\n    result += stack.pop()\nprint(result)", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Push all chars, then pop to reverse." },
    javascript: { code: "const s = require('fs').readFileSync('/dev/stdin','utf8').trim();\nconst stack=[...s];\nlet res='';\nwhile(stack.length) res+=stack.pop();\nconsole.log(res);", timeComplexity: "O(n)", spaceComplexity: "O(n)", explanation: "Push all chars, then pop to reverse." }
  },
  "Sum of Binary Tree Nodes": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int sum=0,x;\n    for(int i=0;i<n;i++){scanf(\"%d\",&x);if(x!=-1)sum+=x;}\n    printf(\"%d\",sum);\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Sum all values that are not -1." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n=sc.nextInt(), sum=0;\n        for(int i=0;i<n;i++){int x=sc.nextInt();if(x!=-1)sum+=x;}\n        System.out.println(sum);\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Sum all values that are not -1." },
    python: { code: "n = int(input())\nnodes = list(map(int, input().split()))\nprint(sum(x for x in nodes if x != -1))", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Sum all values that are not -1." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst nodes = lines[1].split(' ').map(Number);\nconsole.log(nodes.filter(x=>x!==-1).reduce((s,x)=>s+x,0));", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Filter -1 and sum rest." }
  },
  "Climbing Stairs": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    if(n<=2){printf(\"%d\",n);return 0;}\n    int a=1,b=2,c;\n    for(int i=3;i<=n;i++){c=a+b;a=b;b=c;}\n    printf(\"%d\",b);\n    return 0;\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Fibonacci pattern: ways(n) = ways(n-1) + ways(n-2)." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        int n = new Scanner(System.in).nextInt();\n        if(n<=2){System.out.println(n);return;}\n        int a=1,b=2;\n        for(int i=3;i<=n;i++){int c=a+b;a=b;b=c;}\n        System.out.println(b);\n    }\n}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Fibonacci pattern: ways(n) = ways(n-1) + ways(n-2)." },
    python: { code: "n = int(input())\nif n <= 2:\n    print(n)\nelse:\n    a, b = 1, 2\n    for _ in range(3, n+1):\n        a, b = b, a+b\n    print(b)", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Fibonacci pattern: ways(n) = ways(n-1) + ways(n-2)." },
    javascript: { code: "const n = parseInt(require('fs').readFileSync('/dev/stdin','utf8').trim());\nif(n<=2){console.log(n);}else{let a=1,b=2;for(let i=3;i<=n;i++){[a,b]=[b,a+b];}console.log(b);}", timeComplexity: "O(n)", spaceComplexity: "O(1)", explanation: "Fibonacci pattern: ways(n) = ways(n-1) + ways(n-2)." }
  },
  "Coin Change (Min Coins)": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n,amount;\n    scanf(\"%d%d\",&n,&amount);\n    int coins[n];\n    for(int i=0;i<n;i++) scanf(\"%d\",&coins[i]);\n    int dp[amount+1];\n    for(int i=0;i<=amount;i++) dp[i]=amount+1;\n    dp[0]=0;\n    for(int i=1;i<=amount;i++)\n        for(int j=0;j<n;j++)\n            if(coins[j]<=i && dp[i-coins[j]]+1<dp[i])\n                dp[i]=dp[i-coins[j]]+1;\n    printf(\"%d\",dp[amount]>amount?-1:dp[amount]);\n    return 0;\n}", timeComplexity: "O(n*amount)", spaceComplexity: "O(amount)", explanation: "DP: dp[i] = min coins to make amount i." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n=sc.nextInt(), amount=sc.nextInt();\n        int[] coins=new int[n];\n        for(int i=0;i<n;i++) coins[i]=sc.nextInt();\n        int[] dp=new int[amount+1];\n        Arrays.fill(dp,amount+1);\n        dp[0]=0;\n        for(int i=1;i<=amount;i++)\n            for(int c:coins) if(c<=i) dp[i]=Math.min(dp[i],dp[i-c]+1);\n        System.out.println(dp[amount]>amount?-1:dp[amount]);\n    }\n}", timeComplexity: "O(n*amount)", spaceComplexity: "O(amount)", explanation: "DP: dp[i] = min coins to make amount i." },
    python: { code: "n, amount = map(int, input().split())\ncoins = list(map(int, input().split()))\ndp = [amount+1] * (amount+1)\ndp[0] = 0\nfor i in range(1, amount+1):\n    for c in coins:\n        if c <= i:\n            dp[i] = min(dp[i], dp[i-c]+1)\nprint(-1 if dp[amount] > amount else dp[amount])", timeComplexity: "O(n*amount)", spaceComplexity: "O(amount)", explanation: "DP: dp[i] = min coins to make amount i." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst [n,amount] = lines[0].split(' ').map(Number);\nconst coins = lines[1].split(' ').map(Number);\nconst dp = Array(amount+1).fill(amount+1);\ndp[0]=0;\nfor(let i=1;i<=amount;i++) for(const c of coins) if(c<=i) dp[i]=Math.min(dp[i],dp[i-c]+1);\nconsole.log(dp[amount]>amount?-1:dp[amount]);", timeComplexity: "O(n*amount)", spaceComplexity: "O(amount)", explanation: "DP: dp[i] = min coins to make amount i." }
  },
  "Longest Increasing Subsequence": {
    c: { code: "#include<stdio.h>\nint main(){\n    int n;\n    scanf(\"%d\",&n);\n    int arr[n],dp[n];\n    for(int i=0;i<n;i++){scanf(\"%d\",&arr[i]);dp[i]=1;}\n    int ans=1;\n    for(int i=1;i<n;i++){\n        for(int j=0;j<i;j++)\n            if(arr[j]<arr[i]&&dp[j]+1>dp[i]) dp[i]=dp[j]+1;\n        if(dp[i]>ans) ans=dp[i];\n    }\n    printf(\"%d\",ans);\n    return 0;\n}", timeComplexity: "O(n²)", spaceComplexity: "O(n)", explanation: "DP: dp[i] = LIS ending at index i." },
    java: { code: "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr=new int[n], dp=new int[n];\n        Arrays.fill(dp,1);\n        for(int i=0;i<n;i++) arr[i]=sc.nextInt();\n        int ans=1;\n        for(int i=1;i<n;i++){\n            for(int j=0;j<i;j++) if(arr[j]<arr[i]) dp[i]=Math.max(dp[i],dp[j]+1);\n            ans=Math.max(ans,dp[i]);\n        }\n        System.out.println(ans);\n    }\n}", timeComplexity: "O(n²)", spaceComplexity: "O(n)", explanation: "DP: dp[i] = LIS ending at index i." },
    python: { code: "n = int(input())\narr = list(map(int, input().split()))\ndp = [1]*n\nfor i in range(1,n):\n    for j in range(i):\n        if arr[j]<arr[i]: dp[i]=max(dp[i],dp[j]+1)\nprint(max(dp))", timeComplexity: "O(n²)", spaceComplexity: "O(n)", explanation: "DP: dp[i] = LIS ending at index i." },
    javascript: { code: "const lines = require('fs').readFileSync('/dev/stdin','utf8').trim().split('\\n');\nconst arr = lines[1].split(' ').map(Number);\nconst dp = Array(arr.length).fill(1);\nfor(let i=1;i<arr.length;i++) for(let j=0;j<i;j++) if(arr[j]<arr[i]) dp[i]=Math.max(dp[i],dp[j]+1);\nconsole.log(Math.max(...dp));", timeComplexity: "O(n²)", spaceComplexity: "O(n)", explanation: "DP: dp[i] = LIS ending at index i." }
  },
};

main()
  .catch((e) => { console.error("❌ Failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
