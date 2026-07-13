def _fallback_dsa_problems(count: int, difficulty: str, target_role: str) -> list[dict]:
    """Deterministic fallback problems when the LLM is unavailable."""
    bank = [
        {
            "title": "Two Sum",
            "description": (
                "Given an array of integers `nums` and an integer `target`, return the "
                "indices of the two numbers such that they add up to `target`.\n\n"
                "You may assume that each input would have exactly one solution, and "
                "you may not use the same element twice. You can return the answer in any order."
            ),
            "difficulty": "easy",
            "constraints": "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
            "examples": [
                {
                    "input": "nums = [2,7,11,15], target = 9",
                    "output": "[0,1]",
                    "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1].",
                },
                {
                    "input": "nums = [3,2,4], target = 6",
                    "output": "[1,2]",
                    "explanation": "nums[1] + nums[2] == 6.",
                },
            ],
            "topics": ["arrays", "hash-map"],
            "expected_approach": "Use a hash map of value→index while iterating; for each num check if target-num exists.",
            "starterCode": {
                "python": "from typing import List\n\ndef twoSum(nums: List[int], target: int) -> List[int]:\n    # Write your solution here\n    pass\n",
                "javascript": "/**\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nfunction twoSum(nums, target) {\n  // Write your solution here\n}\n",
                "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n}\n",
                "cpp": "#include <vector>\n#include <unordered_map>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your solution here\n        return {};\n    }\n};\n",
            },
        },
        {
            "title": "Valid Parentheses",
            "description": (
                "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', "
                "determine if the input string is valid.\n\n"
                "An input string is valid if:\n"
                "1. Open brackets must be closed by the same type of brackets.\n"
                "2. Open brackets must be closed in the correct order.\n"
                "3. Every close bracket has a corresponding open bracket of the same type."
            ),
            "difficulty": "easy",
            "constraints": "1 <= s.length <= 10^4\ns consists of parentheses only: '()[]{}'.",
            "examples": [
                {"input": 's = "()"', "output": "true", "explanation": "Matched pair."},
                {"input": 's = "()[]{}"', "output": "true", "explanation": "All pairs valid."},
                {"input": 's = "(]"', "output": "false", "explanation": "Mismatched types."},
            ],
            "topics": ["stack", "strings"],
            "expected_approach": "Use a stack; push openers, pop and match on closers.",
            "starterCode": {
                "python": "def isValid(s: str) -> bool:\n    # Write your solution here\n    pass\n",
                "javascript": "/**\n * @param {string} s\n * @return {boolean}\n */\nfunction isValid(s) {\n  // Write your solution here\n}\n",
                "java": "class Solution {\n    public boolean isValid(String s) {\n        // Write your solution here\n        return false;\n    }\n}\n",
                "cpp": "#include <string>\n#include <stack>\nusing namespace std;\n\nclass Solution {\npublic:\n    bool isValid(string s) {\n        // Write your solution here\n        return false;\n    }\n};\n",
            },
        },
        {
            "title": "Longest Substring Without Repeating Characters",
            "description": (
                "Given a string `s`, find the length of the longest substring without repeating characters."
            ),
            "difficulty": "medium",
            "constraints": "0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.",
            "examples": [
                {"input": 's = "abcabcbb"', "output": "3", "explanation": 'The answer is "abc", with length 3.'},
                {"input": 's = "bbbbb"', "output": "1", "explanation": 'The answer is "b", with length 1.'},
                {"input": 's = "pwwkew"', "output": "3", "explanation": 'The answer is "wke", with length 3.'},
            ],
            "topics": ["sliding-window", "hash-map", "strings"],
            "expected_approach": "Sliding window with a set/map of last-seen indices; expand right, shrink left on duplicates.",
            "starterCode": {
                "python": "def lengthOfLongestSubstring(s: str) -> int:\n    # Write your solution here\n    pass\n",
                "javascript": "/**\n * @param {string} s\n * @return {number}\n */\nfunction lengthOfLongestSubstring(s) {\n  // Write your solution here\n}\n",
                "java": "class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        // Write your solution here\n        return 0;\n    }\n}\n",
                "cpp": "#include <string>\n#include <unordered_set>\nusing namespace std;\n\nclass Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        // Write your solution here\n        return 0;\n    }\n};\n",
            },
        },
        {
            "title": "Merge Intervals",
            "description": (
                "Given an array of `intervals` where intervals[i] = [start_i, end_i], merge all "
                "overlapping intervals, and return an array of the non-overlapping intervals that "
                "cover all the intervals in the input."
            ),
            "difficulty": "medium",
            "constraints": "1 <= intervals.length <= 10^4\nintervals[i].length == 2\n0 <= start_i <= end_i <= 10^4",
            "examples": [
                {
                    "input": "intervals = [[1,3],[2,6],[8,10],[15,18]]",
                    "output": "[[1,6],[8,10],[15,18]]",
                    "explanation": "[1,3] and [2,6] overlap, merge into [1,6].",
                },
                {
                    "input": "intervals = [[1,4],[4,5]]",
                    "output": "[[1,5]]",
                    "explanation": "Intervals touch at 4; merge.",
                },
            ],
            "topics": ["arrays", "sorting", "intervals"],
            "expected_approach": "Sort by start, then linear scan merging when current.start <= last.end.",
            "starterCode": {
                "python": "from typing import List\n\ndef merge(intervals: List[List[int]]) -> List[List[int]]:\n    # Write your solution here\n    pass\n",
                "javascript": "/**\n * @param {number[][]} intervals\n * @return {number[][]}\n */\nfunction merge(intervals) {\n  // Write your solution here\n}\n",
                "java": "class Solution {\n    public int[][] merge(int[][] intervals) {\n        // Write your solution here\n        return new int[][]{};\n    }\n}\n",
                "cpp": "#include <vector>\n#include <algorithm>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<vector<int>> merge(vector<vector<int>>& intervals) {\n        // Write your solution here\n        return {};\n    }\n};\n",
            },
        },
        {
            "title": "Binary Tree Level Order Traversal",
            "description": (
                "Given the `root` of a binary tree, return the level order traversal of its nodes' "
                "values (i.e., from left to right, level by level)."
            ),
            "difficulty": "medium",
            "constraints": "The number of nodes is in the range [0, 2000].\n-1000 <= Node.val <= 1000",
            "examples": [
                {
                    "input": "root = [3,9,20,null,null,15,7]",
                    "output": "[[3],[9,20],[15,7]]",
                    "explanation": "BFS level by level.",
                },
            ],
            "topics": ["trees", "bfs", "queues"],
            "expected_approach": "BFS with a queue; process level size batches.",
            "starterCode": {
                "python": "from typing import List, Optional\n\nclass TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n\ndef levelOrder(root: Optional[TreeNode]) -> List[List[int]]:\n    # Write your solution here\n    pass\n",
                "javascript": "/**\n * Definition for a binary tree node.\n * function TreeNode(val, left, right) {\n *     this.val = (val===undefined ? 0 : val)\n *     this.left = (left===undefined ? null : left)\n *     this.right = (right===undefined ? null : right)\n * }\n */\n/**\n * @param {TreeNode} root\n * @return {number[][]}\n */\nfunction levelOrder(root) {\n  // Write your solution here\n}\n",
                "java": "import java.util.*;\nclass TreeNode {\n    int val; TreeNode left; TreeNode right;\n    TreeNode() {}\n    TreeNode(int val) { this.val = val; }\n    TreeNode(int val, TreeNode left, TreeNode right) {\n        this.val = val; this.left = left; this.right = right;\n    }\n}\nclass Solution {\n    public List<List<Integer>> levelOrder(TreeNode root) {\n        // Write your solution here\n        return new ArrayList<>();\n    }\n}\n",
                "cpp": "#include <vector>\n#include <queue>\nusing namespace std;\n\nstruct TreeNode {\n    int val; TreeNode *left; TreeNode *right;\n    TreeNode() : val(0), left(nullptr), right(nullptr) {}\n    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}\n    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}\n};\n\nclass Solution {\npublic:\n    vector<vector<int>> levelOrder(TreeNode* root) {\n        // Write your solution here\n        return {};\n    }\n};\n",
            },
        },
        {
            "title": "Word Ladder",
            "description": (
                "A transformation sequence from word `beginWord` to word `endWord` using a dictionary "
                "`wordList` is a sequence of words beginWord -> s1 -> s2 -> ... -> sk such that:\n\n"
                "- Every adjacent pair of words differs by a single letter.\n"
                "- Every si for 1 <= i <= k is in wordList. Note that beginWord does not need to be in wordList.\n"
                "- sk == endWord\n\n"
                "Given two words, beginWord and endWord, and a dictionary wordList, return the number of "
                "words in the shortest transformation sequence from beginWord to endWord, or 0 if no such "
                "sequence exists."
            ),
            "difficulty": "hard",
            "constraints": (
                "1 <= beginWord.length <= 10\nendWord.length == beginWord.length\n"
                "1 <= wordList.length <= 5000\nwordList[i].length == beginWord.length\n"
                "beginWord, endWord, and wordList[i] consist of lowercase English letters.\n"
                "beginWord != endWord\nAll the words in wordList are unique."
            ),
            "examples": [
                {
                    "input": 'beginWord = "hit", endWord = "cog", wordList = ["hot","dot","dog","lot","log","cog"]',
                    "output": "5",
                    "explanation": 'One shortest transformation is "hit" -> "hot" -> "dot" -> "dog" -> "cog".',
                },
            ],
            "topics": ["bfs", "graphs", "strings"],
            "expected_approach": "BFS over the word graph; neighbors differ by one character. Optionally bidirectional BFS.",
            "starterCode": {
                "python": "from typing import List\n\ndef ladderLength(beginWord: str, endWord: str, wordList: List[str]) -> int:\n    # Write your solution here\n    pass\n",
                "javascript": "/**\n * @param {string} beginWord\n * @param {string} endWord\n * @param {string[]} wordList\n * @return {number}\n */\nfunction ladderLength(beginWord, endWord, wordList) {\n  // Write your solution here\n}\n",
                "java": "import java.util.*;\nclass Solution {\n    public int ladderLength(String beginWord, String endWord, List<String> wordList) {\n        // Write your solution here\n        return 0;\n    }\n}\n",
                "cpp": "#include <string>\n#include <vector>\n#include <unordered_set>\n#include <queue>\nusing namespace std;\n\nclass Solution {\npublic:\n    int ladderLength(string beginWord, string endWord, vector<string>& wordList) {\n        // Write your solution here\n        return 0;\n    }\n};\n",
            },
        },
    ]

    # Filter by difficulty when not mixed
    if difficulty and difficulty != "mixed":
        filtered = [p for p in bank if p["difficulty"] == difficulty]
        if not filtered:
            filtered = bank
    else:
        filtered = bank

    selected = filtered[: max(1, min(count, len(filtered)))]
    # Tag role context lightly without changing problem correctness
    for p in selected:
        p["roleContext"] = target_role
    return selected
