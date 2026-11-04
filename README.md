<div align="center">

# Poster Maker

### 아이디어를 포스터로

텍스트에서 시작해 AI로 포스터를 만들고, SVG로 세부 편집까지 해보는 개인 프로젝트입니다.

[**라이브 데모 열기 →**](https://poster-maker-5mv7.onrender.com/)

<br>

![Node.js](https://img.shields.io/badge/Node.js-20%2B-43853d?style=flat-square&logo=node.js&logoColor=white)
![OpenAI API](https://img.shields.io/badge/AI-OpenAI_API-111111?style=flat-square&logo=openai&logoColor=white)
![Render](https://img.shields.io/badge/배포-Render-5b36d5?style=flat-square&logo=render&logoColor=white)

</div>

---

행사 안내, 공지, 캠페인 문구나 간단한 아이디어를 입력하면 AI가 포스터 문구와 이미지 구성을 제안합니다. 스타일과 비율을 고르고 결과를 다듬어 PNG 또는 편집 가능한 SVG로 저장할 수 있습니다.

## 주요 기능

- **20가지 디자인 스타일:** Swiss Editorial, Bauhaus Modular, Risograph, Y2K Digital, Minimalist 등
- **6가지 포스터 비율:** 정사각형, 세로형, 가로형
- **한국어·영어·일본어** 문구 생성
- **스타일 추천:** 원하는 스타일을 고르거나 AI 추천 사용
- **레이어별 이미지 생성:** 배경과 선택한 주 피사체를 따로 생성
- **참고 이미지 첨부:** 주 피사체 생성 시 PNG, JPG, WEBP 이미지 참고
- **SVG·PNG 저장:** 편집용 SVG와 공유용 PNG 제공
- **크레딧 소진 안내:** API 잔액이나 사용 한도에 도달하면 안내 문구 표시

## 기술 스택

| 영역 | 사용 기술 | 역할 |
| --- | --- | --- |
| 화면 | HTML, CSS, Vanilla JavaScript | 포스터 입력·편집 UI, 미리보기, 다운로드 |
| 서버 | Node.js 20+, ES Modules, `node:http` | 정적 파일 제공 및 API 요청 처리 |
| 생성형 AI | OpenAI Responses API | 문구 정리, 스타일 추천, 이미지 구성안 작성 |
| 이미지 생성 | OpenAI Images API | 배경과 선택형 주 피사체 생성·편집 |
| 파일 출력 | SVG, Canvas API, PNG | 개체별 편집용 SVG와 평면 이미지 PNG 생성 |
| 배포 | Render Web Service | 웹 앱 배포와 서버 환경 변수 관리 |

외부 Node.js 패키지 없이 Node.js 내장 기능과 브라우저 API를 중심으로 구성했습니다.

## 사용 흐름

1. 포스터로 만들 내용이나 아이디어를 입력합니다.
2. 스타일, 비율, 문구 언어를 선택합니다.
3. AI가 작성한 제목·보조 문구·세부 정보를 확인하고 수정합니다.
4. 배경을 생성하고, 필요하면 주 피사체를 별도 이미지 레이어로 생성합니다.
5. SVG 또는 PNG로 저장합니다.

## SVG 편집 안내

SVG 파일은 **Adobe Illustrator** 또는 **Inkscape**에서 열어 배경, 별도 주 피사체, 문구 개체를 선택하고 편집할 수 있습니다.

- 생성된 배경 이미지 전체는 하나의 이미지 개체입니다. 배경 안의 식물이나 소품이 자동으로 각각 분리되지는 않습니다.
- 주 피사체 생성을 선택했다면 해당 이미지는 배경과 별도 개체로 들어갑니다.
- PNG는 한 장의 이미지로 합쳐집니다.
- Photoshop용 PSD 저장은 지원하지 않습니다.

## 로컬에서 실행하기

### 준비물

- Node.js 20 이상
- API 사용이 가능한 OpenAI API 키

저장소를 내려받습니다.

```bash
git clone https://github.com/Dong-DDack/Poster-Maker.git
cd Poster-Maker
```

프로젝트 최상위 폴더에 `.env` 파일을 만들고 API 키를 입력합니다.

```env
OPENAI_API_KEY=발급받은_API_키
```

서버를 실행합니다.

```bash
npm install
npm start
```

Windows PowerShell에서 `npm start`가 실행되지 않으면 다음 명령을 사용하세요.

```powershell
npm.cmd start
```

터미널에 표시되는 로컬 주소를 브라우저에서 엽니다. `.env` 파일에는 비밀 키가 있으므로 GitHub에 올리지 마세요. 이 저장소는 `.env`를 `.gitignore`로 제외합니다.

## Render 배포

GitHub 저장소를 연결해 **Web Service**를 생성하고 아래 명령을 지정합니다.

| 설정 | 값 |
| --- | --- |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Environment Variable 이름 | `OPENAI_API_KEY` |
| Environment Variable 값 | 본인의 OpenAI API 키 |

키는 Render 서비스의 **Environment** 설정에만 입력하세요. 공개 데모 방문자의 요청은 서버에 등록한 소유자의 API 잔액을 사용합니다. Render 무료 서비스는 일정 시간 접속이 없으면 잠들 수 있어, 다시 접속할 때 첫 응답이 늦어질 수 있습니다.

## 비용 및 사용 시 참고

- 문구 구성, 배경 생성, 선택형 주 피사체 생성은 각각 별도 API 요청이며 사용료가 발생할 수 있습니다.
- 포스터 한 장을 만들 때 이미지 레이어 수에 따라 요청 횟수가 달라집니다.
- 공개 데모에는 로그인이나 사용자별 사용량 제한이 없습니다. API 사용량은 OpenAI Usage에서, 호스팅 사용량은 Render Billing에서 확인하세요.
- 생성된 문구와 이미지의 날짜, 장소, 가격, 링크 등 사실 정보를 저장 전에 확인하세요.
- 첨부하는 참고 이미지는 사용 권한이 있는 자료인지 확인하세요.
- 이 데모는 개인 프로젝트 및 실험용입니다.

## 라이선스

현재 별도 오픈소스 라이선스가 지정되어 있지 않습니다. 코드의 재사용이나 재배포 전에 저장소 소유자에게 문의해 주세요.
