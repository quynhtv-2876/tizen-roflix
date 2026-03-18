## Repo overview

This repository runs a small Express server that scrapes and proxies video streams from a target site using Puppeteer + Cheerio.

Key files

- `server.js` — the entire application (no other modules). Contains server setup, Puppeteer helpers, route handlers and a proxy for .m3u8/.vtt responses.
- `package.json` — dependencies and scripts. Use `npm start` (added) to run.

Big-picture architecture (what an AI agent should know)

- Single-process Express app exposing endpoints under `/api` (protected by an API key header `x-api-key`). The public root (`/`) returns a health string.
- Puppeteer is used to render pages and extract DOM content or network responses; Cheerio is used to parse the rendered HTML for list/details endpoints.
- The `/api/watch` route opens an episode page, clicks the embedded player, listens for network responses to capture `.m3u8` (HLS) and `.vtt` subtitle requests, then returns proxied URLs pointing back to `/api/proxy` on this server.
- `/api/proxy` fetches either text playlists/subtitle files or streams media and rewrites playlist segment URLs to route back through the proxy.

Why it's designed this way

- Puppeteer + stealth plugin is required because the target site serves content via JS and may try to detect automated scraping.
- Proxying HLS playlists ensures clients can fetch segments with correct Referer/User-Agent headers.

Environment and runtime

- The app expects environment variables in a `.env` file loaded via `dotenv` at the top of `server.js`.
  - `API_KEY` (required) — server will exit if not present. Used to authenticate requests via header `x-api-key`.
  - `PORT` (optional) — port to listen on (defaults to 3000).
  - `BASE_URL` (optional) — target site base URL (defaults to `https://rophim.mx`).

How to run locally (developer flows)

- Create a `.env` file in the repo root with at least:

  API_KEY=your-test-key
  PORT=3000
  BASE_URL=<https://rophim.mx>

- Start server:

  npm install
  npm start

- Call endpoints with header `x-api-key: <API_KEY>`; example:
  - GET `/api/list` — returns an array of { title, link, imageUrl }
  - GET `/api/details?movieUrl=/path` — returns { description, episodes }
  - GET `/api/watch?episodeUrl=/path` — returns proxied video/subtitle URLs
  - The proxy endpoint: `/api/proxy?videoUrl=<encoded>&referer=<encoded>`

Project-specific conventions and patterns

- Single-file app: everything is in `server.js`. When editing, keep helper functions (launchBrowser, autoScroll) near the top; route handlers follow.
- Error messages, logs, and comments must be in English — use clear, professional language for all code documentation and user-facing messages.
- API auth: every `/api` route is behind `authenticateKey` middleware. When adding new API routes, mount them onto `apiRouter` to inherit auth.
- Puppeteer configuration: browser launch uses a set of flags optimized for headless/container environments (`--no-sandbox`, `--disable-dev-shm-usage`, etc.). Keep these flags for Docker or server usage.
- Proxy rewriting: the proxy rewrites non-# playlist lines into `/api/proxy?videoUrl=...&referer=...`. When changing this logic, ensure absolute/relative URLs are handled the same way.

Examples from code to copy/pattern-match

- Auth middleware (use header `x-api-key` and compare to `process.env.API_KEY`): see `authenticateKey` in `server.js`.
- Capturing network responses in `/api/watch`: the code listens on `page.on('response', ...)` and resolves when an `.m3u8` URL is detected — preserve this event-driven pattern when extracting resources.
- Playlist rewriting (in `/api/proxy`): split the playlist by line, map relative segment lines to absolute URLs, then return a playlist that points back at this proxy.

Tests and debugging hints

- No tests currently. When writing tests, spin up the server on a different PORT and mock Puppeteer/networking where possible.
- To debug Puppeteer scripts locally, set `headless: false` in `launchBrowser()` temporarily and pass `slowMo` or open the devtools in the launched browser.

Limitations and safe-guards for AI edits

- Do not remove API key enforcement — the server intentionally exits when `API_KEY` is missing to avoid accidental public scraping.
- Be careful when adjusting timeouts and waits inside Puppeteer — target site is dynamic and relies on scroll/wait patterns.
- Avoid introducing global asynchronous side-effects in the top-level file (server.js is loaded once and runs immediately).

If something's unclear

- If you need an alternate BASE_URL for testing, add it to `.env` and confirm endpoints still resolve CSS selectors used in `server.js`.

If you want changes to this guidance

- Tell me which section is unclear or add any missing conventions you use (branching, PR templates, tests) and I will update this file.

# Project Context

Ultracite enforces strict type safety, accessibility standards, and consistent code quality for JavaScript/TypeScript projects using Biome's lightning-fast formatter and linter.

## Key Principles

- Zero configuration required
- Subsecond performance
- Maximum type safety
- AI-friendly code generation

## Before Writing Code

1. Analyze existing patterns in the codebase
2. Consider edge cases and error scenarios
3. Follow the rules below strictly
4. Validate accessibility requirements

## Rules

### Accessibility (a11y)

- Don't use `accessKey` attribute on any HTML element.
- Don't set `aria-hidden="true"` on focusable elements.
- Don't add ARIA roles, states, and properties to elements that don't support them.
- Don't use distracting elements like `<marquee>` or `<blink>`.
- Only use the `scope` prop on `<th>` elements.
- Don't assign non-interactive ARIA roles to interactive HTML elements.
- Make sure label elements have text content and are associated with an input.
- Don't assign interactive ARIA roles to non-interactive HTML elements.
- Don't assign `tabIndex` to non-interactive HTML elements.
- Don't use positive integers for `tabIndex` property.
- Don't include "image", "picture", or "photo" in img alt prop.
- Don't use explicit role property that's the same as the implicit/default role.
- Make static elements with click handlers use a valid role attribute.
- Always include a `title` element for SVG elements.
- Give all elements requiring alt text meaningful information for screen readers.
- Make sure anchors have content that's accessible to screen readers.
- Assign `tabIndex` to non-interactive HTML elements with `aria-activedescendant`.
- Include all required ARIA attributes for elements with ARIA roles.
- Make sure ARIA properties are valid for the element's supported roles.
- Always include a `type` attribute for button elements.
- Make elements with interactive roles and handlers focusable.
- Give heading elements content that's accessible to screen readers (not hidden with `aria-hidden`).
- Always include a `lang` attribute on the html element.
- Always include a `title` attribute for iframe elements.
- Accompany `onClick` with at least one of: `onKeyUp`, `onKeyDown`, or `onKeyPress`.
- Accompany `onMouseOver`/`onMouseOut` with `onFocus`/`onBlur`.
- Include caption tracks for audio and video elements.
- Use semantic elements instead of role attributes in JSX.
- Make sure all anchors are valid and navigable.
- Ensure all ARIA properties (`aria-*`) are valid.
- Use valid, non-abstract ARIA roles for elements with ARIA roles.
- Use valid ARIA state and property values.
- Use valid values for the `autocomplete` attribute on input elements.
- Use correct ISO language/country codes for the `lang` attribute.

### Code Complexity and Quality

- Don't use consecutive spaces in regular expression literals.
- Don't use the `arguments` object.
- Don't use primitive type aliases or misleading types.
- Don't use the comma operator.
- Don't use empty type parameters in type aliases and interfaces.
- Don't write functions that exceed a given Cognitive Complexity score.
- Don't nest describe() blocks too deeply in test files.
- Don't use unnecessary boolean casts.
- Don't use unnecessary callbacks with flatMap.
- Use for...of statements instead of Array.forEach.
- Don't create classes that only have static members (like a static namespace).
- Don't use this and super in static contexts.
- Don't use unnecessary catch clauses.
- Don't use unnecessary constructors.
- Don't use unnecessary continue statements.
- Don't export empty modules that don't change anything.
- Don't use unnecessary escape sequences in regular expression literals.
- Don't use unnecessary fragments.
- Don't use unnecessary labels.
- Don't use unnecessary nested block statements.
- Don't rename imports, exports, and destructured assignments to the same name.
- Don't use unnecessary string or template literal concatenation.
- Don't use String.raw in template literals when there are no escape sequences.
- Don't use useless case statements in switch statements.
- Don't use ternary operators when simpler alternatives exist.
- Don't use useless `this` aliasing.
- Don't use any or unknown as type constraints.
- Don't initialize variables to undefined.
- Don't use the void operators (they're not familiar).
- Use arrow functions instead of function expressions.
- Use Date.now() to get milliseconds since the Unix Epoch.
- Use .flatMap() instead of map().flat() when possible.
- Use literal property access instead of computed property access.
- Don't use parseInt() or Number.parseInt() when binary, octal, or hexadecimal literals work.
- Use concise optional chaining instead of chained logical expressions.
- Use regular expression literals instead of the RegExp constructor when possible.
- Don't use number literal object member names that aren't base 10 or use underscore separators.
- Remove redundant terms from logical expressions.
- Use while loops instead of for loops when you don't need initializer and update expressions.
- Don't pass children as props.
- Don't reassign const variables.
- Don't use constant expressions in conditions.
- Don't use `Math.min` and `Math.max` to clamp values when the result is constant.
- Don't return a value from a constructor.
- Don't use empty character classes in regular expression literals.
- Don't use empty destructuring patterns.
- Don't call global object properties as functions.
- Don't declare functions and vars that are accessible outside their block.
- Make sure builtins are correctly instantiated.
- Don't use super() incorrectly inside classes. Also check that super() is called in classes that extend other constructors.
- Don't use variables and function parameters before they're declared.
- Don't use 8 and 9 escape sequences in string literals.
- Don't use literal numbers that lose precision.

### React and JSX Best Practices

- Don't use the return value of React.render.
- Make sure all dependencies are correctly specified in React hooks.
- Make sure all React hooks are called from the top level of component functions.
- Don't forget key props in iterators and collection literals.
- Don't destructure props inside JSX components in Solid projects.
- Don't define React components inside other components.
- Don't use event handlers on non-interactive elements.
- Don't assign to React component props.
- Don't use both `children` and `dangerouslySetInnerHTML` props on the same element.
- Don't use dangerous JSX props.
- Don't use Array index in keys.
- Don't insert comments as text nodes.
- Don't assign JSX properties multiple times.
- Don't add extra closing tags for components without children.
- Use `<>...</>` instead of `<Fragment>...</Fragment>`.
- Watch out for possible "wrong" semicolons inside JSX elements.

### Correctness and Safety

- Don't assign a value to itself.
- Don't return a value from a setter.
- Don't compare expressions that modify string case with non-compliant values.
- Don't use lexical declarations in switch clauses.
- Don't use variables that haven't been declared in the document.
- Don't write unreachable code.
- Make sure super() is called exactly once on every code path in a class constructor before this is accessed if the class has a superclass.
- Don't use control flow statements in finally blocks.
- Don't use optional chaining where undefined values aren't allowed.
- Don't have unused function parameters.
- Don't have unused imports.
- Don't have unused labels.
- Don't have unused private class members.
- Don't have unused variables.
- Make sure void (self-closing) elements don't have children.
- Don't return a value from a function with the return type 'void'
- Use isNaN() when checking for NaN.
- Make sure "for" loop update clauses move the counter in the right direction.
- Make sure typeof expressions are compared to valid values.
- Make sure generator functions contain yield.
- Don't use await inside loops.
- Don't use bitwise operators.
- Don't use expressions where the operation doesn't change the value.
- Make sure Promise-like statements are handled appropriately.
- Don't use __dirname and__filename in the global scope.
- Prevent import cycles.
- Don't use configured elements.
- Don't hardcode sensitive data like API keys and tokens.
- Don't let variable declarations shadow variables from outer scopes.
- Don't use the TypeScript directive @ts-ignore.
- Prevent duplicate polyfills from Polyfill.io.
- Don't use useless backreferences in regular expressions that always match empty strings.
- Don't use unnecessary escapes in string literals.
- Don't use useless undefined.
- Make sure getters and setters for the same property are next to each other in class and object definitions.
- Make sure object literals are declared consistently (defaults to explicit definitions).
- Use static Response methods instead of new Response() constructor when possible.
- Make sure switch-case statements are exhaustive.
- Make sure the `preconnect` attribute is used when using Google Fonts.
-- Prefer using Array.prototype.indexOf or Array.prototype.lastIndexOf instead of Array.prototype.findIndex or Array.prototype.findLastIndex when looking for the index of an item.
-- When calling Number.prototype.toFixed, always pass the digits argument explicitly (for example: num.toFixed(2)).
- Use numeric separators in numeric literals.
- Use object spread instead of `Object.assign()` when constructing new objects.
- Always use the radix argument when using `parseInt()`.
- Make sure JSDoc comment lines start with a single asterisk, except for the first one.
- Include a description parameter for `Symbol()`.
- Don't use spread (`...`) syntax on accumulators.
- Don't use the `delete` operator.
- Don't access namespace imports dynamically.
- Don't use namespace imports.
- Declare regex literals at the top level.
- Don't use `target="_blank"` without `rel="noopener"`.

### TypeScript Best Practices

- Don't use TypeScript enums.
- Don't export imported variables.
- Don't add type annotations to variables, parameters, and class properties that are initialized with literal expressions.
- Don't use TypeScript namespaces.
- Don't use non-null assertions with the `!` postfix operator.
- Don't use parameter properties in class constructors.
- Don't use user-defined types.
- Use `as const` instead of literal types and type annotations.
- Use either `T[]` or `Array<T>` consistently.
- Initialize each enum member value explicitly.
- Use `export type` for types.
- Use `import type` for types.
- Make sure all enum members are literal values.
- Don't use TypeScript const enum.
- Don't declare empty interfaces.
- Don't let variables evolve into any type through reassignments.
- Don't use the any type.
- Don't misuse the non-null assertion operator (!) in TypeScript files.
- Don't use implicit any type on variable declarations.
- Don't merge interfaces and classes unsafely.
- Don't use overload signatures that aren't next to each other.
- Use the namespace keyword instead of the module keyword to declare TypeScript namespaces.

### Style and Consistency

- Don't use global `eval()`.
- Don't use callbacks in asynchronous tests and hooks.
- Don't use negation in `if` statements that have `else` clauses.
- Don't use nested ternary expressions.
- Don't reassign function parameters.
- This rule lets you specify global variable names you don't want to use in your application.
- Don't use specified modules when loaded by import or require.
- Don't use constants whose value is the upper-case version of their name.
- Use `String.slice()` instead of `String.substr()` and `String.substring()`.
- Don't use template literals if you don't need interpolation or special-character handling.
- Don't use `else` blocks when the `if` block breaks early.
- Don't use yoda expressions.
- Don't use Array constructors.
- Use `at()` instead of integer index access.
- Follow curly brace conventions.
- Use `else if` instead of nested `if` statements in `else` clauses.
- Use single `if` statements instead of nested `if` clauses.
- Use `new` for all builtins except `String`, `Number`, and `Boolean`.
- Use consistent accessibility modifiers on class properties and methods.
- Use `const` declarations for variables that are only assigned once.
- Put default function parameters and optional function parameters last.
- Include a `default` clause in switch statements.
- Use the `**` operator instead of `Math.pow`.
- Use `for-of` loops when you need the index to extract an item from the iterated array.
- Use `node:assert/strict` over `node:assert`.
- Use the `node:` protocol for Node.js builtin modules.
- Use Number properties instead of global ones.
- Use assignment operator shorthand where possible.
- Use function types instead of object types with call signatures.
- Use template literals over string concatenation.
- Use `new` when throwing an error.
- Don't throw non-Error values.
- Use `String.trimStart()` and `String.trimEnd()` over `String.trimLeft()` and `String.trimRight()`.
- Use standard constants instead of approximated literals.
- Don't assign values in expressions.
- Don't use async functions as Promise executors.
- Don't reassign exceptions in catch clauses.
- Don't reassign class members.
- Don't compare against -0.
- Don't use labeled statements that aren't loops.
- Don't use void type outside of generic or return types.
- Don't use console.
- Don't use control characters and escape sequences that match control characters in regular expression literals.
- Don't use debugger.
- Don't assign directly to document.cookie.
- Use `===` and `!==`.
- Don't use duplicate case labels.
- Don't use duplicate class members.
- Don't use duplicate conditions in if-else-if chains.
- Don't use two keys with the same name inside objects.
- Don't use duplicate function parameter names.
- Don't have duplicate hooks in describe blocks.
- Don't use empty block statements and static blocks.
- Don't let switch clauses fall through.
- Don't reassign function declarations.
- Don't allow assignments to native objects and read-only global variables.
- Use Number.isFinite instead of global isFinite.
- Use Number.isNaN instead of global isNaN.
- Don't assign to imported bindings.
- Don't use irregular whitespace characters.
- Don't use labels that share a name with a variable.
- Don't use characters made with multiple code points in character class syntax.
- Make sure to use new and constructor properly.
- Don't use shorthand assign when the variable appears on both sides.
- Don't use octal escape sequences in string literals.
- Don't use Object.prototype builtins directly.
- Don't redeclare variables, functions, classes, and types in the same scope.
- Don't have redundant "use strict".
- Don't compare things where both sides are exactly the same.
- Don't let identifiers shadow restricted names.
- Don't use sparse arrays (arrays with holes).
- Don't use template literal placeholder syntax in regular strings.
- Don't use the then property.
- Don't use unsafe negation.
- Don't use var.
- Don't use with statements in non-strict contexts.
- Make sure async functions actually use await.
- Make sure default clauses in switch statements come last.
- Make sure to pass a message value when creating a built-in error.
- Make sure get methods always return a value.
- Use a recommended display strategy with Google Fonts.
- Make sure for-in loops include an if statement.
- Use Array.isArray() instead of instanceof Array.
-- When calling `Number.prototype.toFixed()`, always pass the digits argument explicitly (e.g. `num.toFixed(2)`).
- Make sure to use the "use strict" directive in script files.

### Next.js Specific Rules

- Don't use `<img>` elements in Next.js projects.
- Don't use `<head>` elements in Next.js projects.
- Don't import next/document outside of pages/_document.jsx in Next.js projects.
- Don't use the next/head module in pages/_document.js on Next.js projects.

### Testing Best Practices

- Don't use export or module.exports in test files.
- Don't use focused tests.
- Make sure the assertion function, like expect, is placed inside an it() function call.
- Don't use disabled tests.

## Common Tasks

- `npx ultracite init` - Initialize Ultracite in your project
- `npx ultracite fix` - Format and fix code automatically
- `npx ultracite check` - Check for issues without fixing

## Example: Error Handling

```typescript
// ✅ Good: Comprehensive error handling
try {
  const result = await fetchData();
  return { success: true, data: result };
} catch (error) {
  console.error('API call failed:', error);
  return { success: false, error: error.message };
}

// ❌ Bad: Swallowing errors
try {
  return await fetchData();
} catch (e) {
  console.log(e);
}
```

# overview

RoFlix - Ứng dụng Xem phim Tizen TV (Cá nhân)

1. Tổng quan (Overview)

Mục tiêu: Xây dựng một ứng dụng TV Tizen (cho Samsung TV) để xem phim từ các nguồn website trực tuyến, phục vụ mục đích sử dụng cá nhân. Ứng dụng không nhắm đến việc phát hành công khai.

Kiến trúc: Dự án bao gồm hai thành phần chính hoạt động phối hợp:

Frontend (Tizen TV App): Giao diện người dùng chạy trực tiếp trên TV Samsung. Chịu trách nhiệm hiển thị danh sách phim, chi tiết, trình phát video và tương tác với người dùng qua remote.

Backend (Node.js API Server): Một server trung gian chạy trên máy tính cá nhân (local) hoặc trên nền tảng đám mây (Render.com). Server này đóng vai trò "cào" (scrape) dữ liệu từ các website nguồn (hiện tại là rophim.mx và API phim.nguonc.com), xử lý và cung cấp dữ liệu (dưới dạng JSON) cho Tizen TV App thông qua các API endpoint. Server cũng đóng vai trò proxy cho luồng video HLS để vượt qua các cơ chế bảo mật.

Luồng hoạt động chính: TV App <-- (API Call) --> Node.js Server <-- (Scraping/API Call) --> Website Nguồn

2. Công nghệ sử dụng (Technologies Used)

Frontend (Tizen TV App - tizen-phim-app):

Ngôn ngữ: HTML5, CSS3, JavaScript (ES6+)

Nền tảng: Tizen Web Application

Thư viện:

hls.js: Để phát video HLS trên Web Simulator (không cần thiết trên TV thật).

Font Awesome: Cho các biểu tượng.

APIs: Tizen Web Device APIs (cho điều khiển remote), Fetch API.

Backend (Node.js API Server - tizen-phim-server):

Runtime: Node.js (v18+)

Framework: Express.js

Scraping/Automation:

Puppeteer-extra + puppeteer-extra-plugin-stealth (với puppeteer-core): Để cào dữ liệu từ các trang web phức tạp (như rophim.mx) và vượt qua các biện pháp chống bot. Yêu cầu Chrome/Chromium cài đặt sẵn.

Cheerio: Để phân tích (parse) cấu trúc HTML.

Networking: Axios: Để gọi API phim.nguonc.com và làm proxy video.

Configuration: Dotenv: Để quản lý biến môi trường qua file .env.

Security: Middleware xác thực API Key đơn giản.

Khác: Cors.

Deployment (Triển khai Server):

Docker: Để đóng gói server và môi trường chạy (bao gồm Chromium) vào container.

Render.com: Nền tảng PaaS miễn phí hỗ trợ Docker để host server.

Git / GitHub: Để quản lý mã nguồn và tự động triển khai lên Render.

Development Environment (Môi trường Phát triển):

Tizen Studio (bản có IDE): Để tạo Certificate, tạo project Tizen, build/run/debug trên TV/Emulator/Simulator.

VS Code (hoặc editor khác): Để viết code cho server Node.js và Tizen App.

Terminal (CLI): Để chạy server local, cài đặt dependencies (npm), build/install Tizen app (tùy chọn).

Trình duyệt (Chrome/Firefox): Để kiểm tra API server, debug Web Simulator, tìm kiếm API nội bộ.

3. Cấu trúc Dự án (Project Structure)

Dự án được chia thành 2 thư mục chính riêng biệt:

tizen-phim-server/: Chứa toàn bộ mã nguồn của Node.js API Server.

server.js: File chính chạy server.

package.json: Quản lý dependencies.

.env: Chứa các biến môi trường (API_KEY, BASE_URL...). Không commit file này.

.gitignore: Quy tắc bỏ qua file/thư mục khi commit.

Dockerfile: Cấu hình để build Docker image cho Render.

healthcheck.js: Script kiểm tra "sức khỏe" cho Docker/Render.

.dockerignore: Quy tắc bỏ qua file/thư mục khi build Docker.

tizen-phim-app/ (Thư mục dự án Tizen, ví dụ tên là roflix): Chứa mã nguồn của ứng dụng chạy trên TV.

index.html: Giao diện và logic chính của ứng dụng.

config.js: File cấu hình chứa URL server và API Key (đã mã hóa Base64).

config.xml: File cấu hình của Tizen App (quyền, metadata...).

icon.png: Biểu tượng ứng dụng.

Các file khác do Tizen Studio tự tạo (.project, .tproject...).

4. Hướng dẫn Cài đặt & Build (Setup & Build Instructions)

4.1. Server (Local Development)

Mục đích: Chạy server trên máy tính cá nhân để phát triển và gỡ lỗi.

Prerequisites:

Node.js (v18+) và npm.

Git.

Google Chrome hoặc Chromium đã được cài đặt.

Clone Repository: git clone <your-repo-url>

Install Dependencies:

cd tizen-phim-server
npm install

# Cài thêm dotenv nếu chưa có

npm install dotenv

# Cài các gói puppeteer cần thiết

npm install puppeteer-core puppeteer-extra puppeteer-extra-plugin-stealth

Create .env file:

Tạo file .env trong thư mục tizen-phim-server.

Copy nội dung từ file .env.example (nếu có) hoặc thêm các dòng sau:

# API Key bí mật của bạn (có thể tự nghĩ ra)

API_KEY=YOUR_SUPER_SECRET_KEY

# URL các nguồn (có thể giữ nguyên mặc định)

ROPHIM_BASE_URL=[https://rophim.mx](https://rophim.mx)
OPHIM_API_URL=[https://phim.nguonc.com/api](https://phim.nguonc.com/api)

# Đường dẫn tới Chrome/Chromium trên máy bạn

CHROME_PATH=/path/to/your/chrome_or_chromium

Tìm CHROME_PATH: Dùng lệnh which google-chrome hoặc whereis google-chrome / which chromium-browser.

Run Server:

node server.js

Server sẽ chạy tại <http://localhost:3000>.

4.2. Tizen TV App (Local Development & Testing)

Mục đích: Build và chạy ứng dụng trên TV thật hoặc máy ảo/simulator để gỡ lỗi giao diện và kết nối.

Prerequisites:

Tizen Studio (bản có IDE) đã được cài đặt.

Trong Package Manager của Tizen Studio, đảm bảo đã cài: Tizen SDK tools, TV Extensions (mới nhất), Samsung Certificate Extension.

Mở Tizen Studio (GUI).

Kết nối TV thật:

Bật Developer Mode trên TV, nhập IP máy tính. Khởi động lại TV.

Trong Tizen Studio, mở Device Manager, kết nối TV (trạng thái "Connected").

Tạo Certificate Samsung:

Mở Certificate Manager, nhấn +, chọn "Samsung", làm theo các bước để tạo profile mới (ví dụ: roflix_samsung_cert). DUID sẽ được lấy tự động.

Tạo Tizen Web Project:

File > New > Tizen Project > Template > TV > Web Application > Basic Project. Đặt tên roflix.

Sao chép Mã nguồn:

Xóa nội dung file index.html mặc định và dán nội dung từ file tizen-phim-app/index.html của chúng ta vào.

Tạo file config.js trong project và dán nội dung từ file tizen-phim-app/config.js vào.

Cấu hình config.js cho Môi trường Test:

Test trên TV thật: Sửa serverUrl thành http://<IP_MAY_TINH_CUA_BAN>:3000.

Test trên Emulator: Sửa serverUrl thành <http://10.0.2.2:3000>.

Test trên Web Simulator: Sửa serverUrl thành <http://localhost:3000>.

Đảm bảo encodedApiKey trong config.js khớp (sau khi mã hóa Base64) với API_KEY trong file .env của server.

Cấu hình config.xml:

Mở config.xml, chọn tab "Source".

Đảm bảo các dòng sau tồn tại bên trong thẻ <widget>:

<tizen:privilege name="[http://tizen.org/privilege/internet](http://tizen.org/privilege/internet)"/>
<access origin="[http://10.0.2.2:3000](http://10.0.2.2:3000)" subdomains="true"/>
<access origin="http://<IP_MAY_TINH_CUA_BAN>:3000" subdomains="true"/>
<access origin="http://localhost:3000" subdomains="true"/>
<access origin="*" subdomains="true"/>
<tizen:content-security-policy>connect-src *;</tizen:content-security-policy>

### API nguonc tham khao

Dành cho nhà phát triển Website

Danh sách phim
Phim mới cập nhật
GEThttps://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=${page}
Ví dụ: https://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=1
Phim theo danh mục
GEThttps://phim.nguonc.com/api/films/danh-sach/${slug}?page=${page}
Ví dụ: <https://phim.nguonc.com/api/films/danh-sach/phim-dang-chieu?page=1>

Phim & Tập Phim
Thông tin Phim & Danh sách tập phim
GEThttps://phim.nguonc.com/api/film/${slug}
Ví dụ: <https://phim.nguonc.com/api/film/hoa-thien-cot>

Thể loại & Quốc gia & Năm
Phim theo thể loại
GEThttps://phim.nguonc.com/api/films/the-loai/${slug}?page=${page}
Ví dụ: <https://phim.nguonc.com/api/films/the-loai/hanh-dong?page=1>
Phim theo quốc gia
GEThttps://phim.nguonc.com/api/films/quoc-gia/${slug}?page=${page}
Ví dụ: <https://phim.nguonc.com/api/films/quoc-gia/au-my?page=1>
Phim theo năm
GEThttps://phim.nguonc.com/api/films/nam-phat-hanh/${slug}?page=${page}
Ví dụ: <https://phim.nguonc.com/api/films/nam-phat-hanh/2024?page=1>

Tìm Phim
Tìm kiếm phim
GEThttps://phim.nguonc.com/api/films/search?keyword=${slug}
Ví dụ: <https://phim.nguonc.com/api/films/search?keyword=Regeneration>
