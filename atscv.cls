%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% CV class
%
% A single-column CV class: tinted header band with photo, accent-coloured
% section headings, and a plain top-to-bottom body.
%
% The body is laid out for machine readability as well as for the eye.
% Applicant tracking systems read the PDF text layer, not the visual layout,
% and several choices here that look like styling mistakes are deliberate
% fixes for extraction defects. Each is commented where it appears. In short:
%
%   - no tables and no multi-column body (cells and columns extract out of
%     reading order, or get dropped entirely)
%   - bullets written inline rather than via itemize
%   - dates inline after the organisation rather than pushed right with \hfill
%   - hyphenation disabled so no keyword is ever split across lines
%
% The photo is safe: an image contributes nothing to the text layer, so it
% cannot disturb the order of the text around it.
%
% To verify after changing anything:
%   make check
% which, among other things, extracts the text layer with pdftotext and checks
% it reads top to bottom in the same order as the page.
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{atscv}[2026/10/17 CV class v2.1]

\DeclareOption*{\PassOptionsToClass{\CurrentOption}{extarticle}}
\ProcessOptions\relax

\LoadClass{extarticle}

%----------------------------------------------------------------------------------------
%	PAGE LAYOUT
%----------------------------------------------------------------------------------------

\usepackage{geometry}

\geometry{
	paper=a4paper,
	top=1.2cm,
	bottom=1.2cm,
	left=1.5cm,
	right=1.5cm,
	footskip=0.6cm,
}

\setlength{\parindent}{0pt}
\pagestyle{empty} % No headers or footers -- parsers often misread them as body text

% Ragged right with hyphenation switched off. Justified text forces words to be
% split across lines, and a parser that does not rejoin "require-\nments" ends up
% indexing two words, neither of them the keyword being searched for.
\raggedright
\hyphenpenalty=10000
\exhyphenpenalty=10000
\tolerance=9999
\emergencystretch=3em

%----------------------------------------------------------------------------------------
%	FONTS
%----------------------------------------------------------------------------------------

\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc} % Keeps accented characters as single extractable glyphs
\usepackage[default]{raleway}
\usepackage{microtype}

\usepackage[hidelinks]{hyperref}

%----------------------------------------------------------------------------------------
%	COLOURS
%----------------------------------------------------------------------------------------

\usepackage{xcolor}

\definecolor{cvaccent}{HTML}{115E59} % Dark teal, used for headings and rules
\definecolor{cvband}{HTML}{F0F6F5}   % Very light teal tint for the header band
\definecolor{cvmuted}{HTML}{5B6660}  % Secondary text: organisations, dates, locations
\definecolor{cvrule}{HTML}{C9DAD7}   % Section underline

%----------------------------------------------------------------------------------------
%	HEADER
%----------------------------------------------------------------------------------------

\usepackage{graphicx}
\usepackage{tikz} % Only used to clip the photo into a circle -- no text inside

% Circular photo. Takes a file path and a diameter.
\newcommand{\cvphoto}[2]{%
	\begin{tikzpicture}
		\clip (0,0) circle (0.5*#2);
		\node at (0,0) {\includegraphics[width=#2]{#1}};
		\draw[cvaccent, line width=0.9pt] (0,0) circle (0.5*#2);
	\end{tikzpicture}%
}

% Header band: photo on the left, name/title/contact on the right, over a tinted
% background. The photo sits in its own box containing no text, so the only text
% in the band is the right-hand block and it extracts as one ordered run.
% With an empty photo argument the text block takes the full width -- photos are
% expected in some countries and discouraged in others, so it is the user's call.
%   #1 photo path (or empty), #2 name, #3 professional title, #4 contact lines
\newcommand{\cvheader}[4]{%
	\colorbox{cvband}{%
		\parbox{\dimexpr\textwidth-2\fboxsep\relax}{%
			\vspace{4pt}
			\ifx\relax#1\relax
				\begin{minipage}[c]{\dimexpr\textwidth-2\fboxsep-0.6cm\relax}
			\else
				\begin{minipage}[c]{2.5cm}
					\cvphoto{#1}{2.3cm}
				\end{minipage}%
				\hspace{0.5cm}%
				\begin{minipage}[c]{\dimexpr\textwidth-2\fboxsep-3.1cm\relax}
			\fi
				{\fontsize{21}{25}\selectfont\color{cvaccent}\textbf{#2}}\\[1pt]
				{\large\color{cvmuted}#3}\\[5pt]
				{\small #4}
			\end{minipage}
			\vspace{4pt}
		}%
	}
	\vspace{2pt}
}

% Separator between contact items
\newcommand{\cvsep}{\hspace{5pt}\textcolor{cvrule}{\textbar}\hspace{5pt}}

%----------------------------------------------------------------------------------------
%	SECTIONS
%----------------------------------------------------------------------------------------

% Section heading: accent-coloured uppercase text above a thin rule. Parsers match
% on the heading wording, so the words matter more than the styling -- keep to
% conventional names in whichever language the CV is written in.
\newcommand{\cvsect}[1]{%
	\vspace{9pt}
	{\normalsize\color{cvaccent}\textbf{\MakeUppercase{#1}}}\par
	\vspace{2.5pt}
	{\color{cvrule}\hrule height 1pt}
	\vspace{5pt}
}

%----------------------------------------------------------------------------------------
%	ENTRIES
%----------------------------------------------------------------------------------------

% A single role or qualification. Location and dates may be empty, in which case
% neither they nor their separator are printed.
%   #1 title, #2 organisation, #3 location, #4 dates
%
% Dates sit inline after the organisation rather than being pushed right with
% \hfill. A \hfill leaves a wide gap that splits the line into two independent
% text objects whose extraction order depends on horizontal position: the date
% can surface before its own job title, or drift away from it entirely, which is
% exactly the association a duration parser needs.
\newcommand{\cventry}[4]{%
	\vspace{5pt}
	\textbf{#1}\par
	\vspace{1pt}
	{\color{cvmuted}#2\ifx\relax#3\relax\else, #3\fi%
		\ifx\relax#4\relax\else\cvsep\textcolor{cvaccent}{#4}\fi}\par
	\vspace{2.5pt}
}

%----------------------------------------------------------------------------------------
%	BULLETS
%----------------------------------------------------------------------------------------

% Bullets are deliberately NOT an itemize environment. A list places each label
% glyph as its own positioned text object, and extractors that group by position
% then emit every bullet together ("- - - -") followed by the text of all the
% items, destroying the pairing between marker and content.
%
% Writing the marker inline keeps "<marker> <text>" as one continuous run, so it
% extracts as a single line no matter how naive the parser is. \hangindent
% reproduces the hanging indent visually.
\newcommand{\cvitem}[1]{%
	\hangindent=1.15em\hangafter=1
	\textcolor{cvaccent}{\textbullet}\hspace{0.55em}#1\par
	\vspace{1.5pt}
}

%----------------------------------------------------------------------------------------
%	SKILLS AND SHORT FACTS
%----------------------------------------------------------------------------------------

% One labelled line of comma-separated keywords. Comma separation is what keyword
% matchers tokenise on, so this is the highest-value section for automated screening.
\newcommand{\cvskill}[2]{%
	\hangindent=1.15em\hangafter=1
	\textbf{#1:} #2\par
	\vspace{1.5pt}
}

% A short labelled fact, used for awards and languages.
\newcommand{\cvline}[2]{%
	\textbf{#1} \textcolor{cvmuted}{\textemdash{} #2}\par
	\vspace{1.5pt}
}
