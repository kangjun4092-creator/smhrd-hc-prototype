# FastAPI 서버 실행에 필요한 라이브러리 설치
# 터미널에서 아래 명령어를 먼저 실행합니다.
# pip install fastapi anyio uvicorn


# 비동기 작업을 처리하기 위한 Python 기본 라이브러리입니다.
# 여기서는 알림 데이터를 저장하고 전달하기 위한 Queue를 만들 때 사용합니다.
import asyncio

# FastAPI 서버를 만들기 위한 클래스
from fastapi import FastAPI

# 서로 다른 주소(Origin)에서 FastAPI 서버에 접근할 수 있도록
# CORS를 설정하기 위해 사용합니다.
from fastapi.middleware.cors import CORSMiddleware

# SSE(Server-Sent Events) 방식으로
# 서버에서 브라우저로 데이터를 전달하기 위해 사용합니다.
from fastapi.sse import EventSourceResponse


# FastAPI 애플리케이션 생성
app = FastAPI()


# --------------------------------------------------
# CORS 설정
# --------------------------------------------------

# HTML은 Live Server(5500번 포트),
# FastAPI는 8000번 포트에서 실행되므로 서로 다른 Origin으로 처리됩니다.
#
# 브라우저에서 FastAPI 서버에 접근할 수 있도록
# 허용할 주소를 설정합니다.
app.add_middleware(
    CORSMiddleware,

    # FastAPI 서버에 접근을 허용할 웹페이지 주소
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],

    # 쿠키, 인증 정보 등을 포함한 요청을 허용합니다.
    allow_credentials=True,

    # 모든 HTTP 요청 방식을 허용합니다.
    # GET, POST, PUT, DELETE 등을 모두 허용
    allow_methods=["*"],

    # 모든 HTTP 요청 헤더를 허용합니다.
    allow_headers=["*"],
)


# --------------------------------------------------
# 알림 Queue 생성
# --------------------------------------------------

# 알림 데이터를 임시로 저장하는 Queue를 생성합니다.
#
# 이상징후가 발생하면 Queue에 알림을 넣고,
# SSE에서는 Queue에 들어온 알림을 꺼내 브라우저로 전달합니다.
#
# [알림 발생]
#      ↓
# alarm_queue
#      ↓
#     SSE
#      ↓
#   브라우저
alarm_queue = asyncio.Queue()


# --------------------------------------------------
# 기본 API
# --------------------------------------------------

# FastAPI 서버가 정상적으로 실행되는지 확인하기 위한 API입니다.
#
# http://127.0.0.1:8000/
@app.get("/")
def index():

    return {
        "message": "Hello FastAPI"
    }


# --------------------------------------------------
# SSE 연결 API
# --------------------------------------------------

# 브라우저의 EventSource가 연결하는 주소입니다.
#
# HTML에서는 다음과 같이 연결합니다.
#
# new EventSource("http://127.0.0.1:8000/alarm")
#
# EventSourceResponse를 사용하면
# FastAPI가 SSE 방식으로 데이터를 전달할 수 있습니다.
@app.get("/alarm", response_class=EventSourceResponse)
async def alarm():

    # 브라우저와 SSE 연결을 유지하면서
    # 새로운 알림이 발생할 때마다 반복해서 전달합니다.
    while True:

        # Queue에 새로운 데이터가 들어올 때까지 기다립니다.
        #
        # Queue가 비어 있다면 불필요하게 계속 확인하는 것이 아니라
        # 새로운 데이터가 들어올 때까지 비동기적으로 대기합니다.
        data = await alarm_queue.get()

        # Queue에서 가져온 알림 데이터를
        # SSE를 통해 브라우저로 전달합니다.
        #
        # return과 달리 yield는 함수를 종료하지 않기 때문에
        # 이후에 발생하는 새로운 알림도 계속 전달할 수 있습니다.
        yield data


# --------------------------------------------------
# 테스트용 알림 API ( 이상징후 감지하는 AI모델을 여기에 추가할 것! )
# --------------------------------------------------

# 아직 실제 객체 탐지 기능을 연결하지 않았기 때문에
# 테스트 목적으로 강제로 알림을 발생시키는 API입니다.
#
# http://127.0.0.1:8000/test-alarm
#
# 위 주소에 접속하면 Queue에 알림 데이터가 추가됩니다.
@app.get("/test-alarm")
async def test_alarm():

    # Queue에 새로운 알림 데이터를 추가합니다.
    #
    # alarm() 함수가 alarm_queue.get()으로 기다리고 있다가
    # 데이터가 들어오면 해당 데이터를 가져갑니다.
    await alarm_queue.put({
        "type": "danger",
        "message": "이상징후가 감지되었습니다."
    })

    # /test-alarm 요청에 대한 일반적인 HTTP 응답입니다.
    # 이 데이터가 SSE로 전달되는 것은 아닙니다.
    return {
        "message": "알림을 발생시켰습니다."
    }