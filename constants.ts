
import { Type } from "@google/genai";

export const PREAMBLE_TEMPLATE = `
% !TEX program = xelatex
\\documentclass[11pt, a4paper]{article}
\\usepackage[UTF8]{ctex}
\\usepackage{amsmath, amssymb, amsthm}
\\usepackage{geometry}
\\usepackage{enumitem}
\\usepackage{fancyhdr}
\\usepackage{cases}
\\usepackage{graphicx}
\\usepackage{textcomp}
\\usepackage{tikz}
\\usepackage{pgfplots}
\\usepackage{setspace} % 控制行间距
\\pgfplotsset{compat=1.18}
\\usetikzlibrary{calc, intersections, through, backgrounds, arrows.meta, shapes.geometric}

% ==========================================
% 试卷排版配置
% ==========================================
\\newcommand{\\choicegap}{__CHOICE_GAP__}
\\newcommand{\\solutiongap}{__SOLUTION_GAP__}
\\setstretch{__LINE_SPACING__} % 设置段落行间距倍率
% ==========================================

% 页面设置
\\geometry{left=2cm, right=2cm, top=2.5cm, bottom=2.5cm}

% 页眉页脚设置
__FANCY_HDR_CONFIG__

% 自定义命令
\\newcommand{\\blank}[1]{\\underline{\\makebox[#1][c]{}}}
\\newcommand{\\fillin}{\\blank{2cm}}

% 全局统一数学环境字号
\\everymath{\\displaystyle}
`;

export const COMMON_KNOWLEDGE_POINTS = [
  "集合与常用逻辑用语",
  "复数代数形式的运算",
  "基本不等式",
  "函数的概念与性质",
  "指数函数与对数函数",
  "导数的几何意义",
  "利用导数研究函数的单调性与极值",
  "三角函数的图像与性质",
  "三角恒等变换",
  "解三角形",
  "平面向量的线性运算",
  "等差数列与等比数列",
  "立体几何：垂直与平行",
  "直线与圆的方程",
  "椭圆的定义与标准方程",
  "双曲线的性质",
  "抛物线的几何性质",
  "概率与古典概型",
  "分层抽样与统计图表",
  "排列组合",
  "二项式定理"
];

export const QUESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          number: { type: Type.STRING, description: "Question number seen in image" },
          content: { type: Type.STRING, description: "LaTeX content of the question" },
          knowledgePoint: { type: Type.STRING, description: "Predicted math knowledge point" },
          type: { type: Type.STRING, description: "Type: 选择题, 填空题, or 解答题" }
        },
        required: ["number", "content", "knowledgePoint", "type"]
      }
    }
  },
  required: ["questions"]
};

export const SYSTEM_INSTRUCTION = `
You are an expert LaTeX typesetter and OCR specialist. 
Extract questions from images/PDFs and return them as structured JSON.

MANDATORY LaTeX FORMATTING RULES:
1. **NO \\n ESCAPE**: Use "\\\\" for explicit line breaks.
2. **Fill-in-the-blanks**: Use "$\\fillin$".
3. **Parallel Symbol**: Use \\mathbin{/\\!/}.
4. **Parentheses**: Use (\\qquad) for choice answer placeholders.
5. **Vectors**: Use \\overrightarrow{AB}.
6. **Mathbf**: Use \\mathbf.
7. **Phi Symbol**: Use \\varphi.
8. **Circled Numbers**: Convert ①, ② to \\textcircled{\\scriptsize{1}}, \\textcircled{\\scriptsize{2}}.
`;
