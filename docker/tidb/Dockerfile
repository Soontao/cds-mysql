FROM ubuntu:20.04

RUN apt update
RUN apt install -y curl mysql-client tzdata
RUN curl --proto '=https' --tlsv1.2 -sSf https://tiup-mirrors.pingcap.com/install.sh | sh

ENV TZ UTC
ENV PATH="${PATH}:/root/.tiup/bin/"

RUN tiup install playground pd tikv tiflash tidb

RUN ulimit -c 1073741824

EXPOSE 4000
EXPOSE 2379

CMD ["tiup", "playground", "--without-monitor", "--db.host", "0.0.0.0"]