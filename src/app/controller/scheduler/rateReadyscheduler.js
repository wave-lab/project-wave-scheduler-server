const express = require('express');
const router = express.Router({ mergeParams: true });
const schedule = require('node-schedule');
const moment = require('moment');

const pool = require('../../module/pool');

const song = require('../../model/schema/song');
const playlist = require('../../model/schema/playlist');//이렇게 해야 접근 가능
const myPlaylist = require('../../model/schema/myPlaylist');
const playlistModules = require('../../module/playlistModules');
const genreModule = require('../../module/genre');
//낮 12시 마다

/**
 * 평가 대기곡 스케줄러
 * 해당 사용자가 업로드한 곡은 제외
 * 사용자가 선호하는 아티스트, 장르 기반
 * 1. 사용자가 좋아하는 아티스트의 노래를 커버한 곡
 * 2. 사용자가 좋아하는 장르
 * 3. 곡들을 사용자 rateReady 플레이리스트에 삽입
 * songStatus 0유보 1 통과 2 실패
 */
'0 5 12 1/1 * ? *'

function shuffleRandom(n) {
    var ar = new Array();
    var temp;
    var rnum;

    //전달받은 매개변수 n만큼 배열 생성 ( 1~n )
    for (var i = 1; i <= n; i++) {
        ar.push(i);
    }

    //값을 서로 섞기
    for (var i = 0; i < ar.length; i++) {
        rnum = Math.floor(Math.random() * n); //난수발생
        temp = ar[i];
        ar[i] = ar[rnum];
        ar[rnum] = temp;
    }

    return ar;
}
const getAllUserIdxQuery = 'SELECT userIdx FROM user';
const getOriginArtistIdxQuery = 'SELECT * FROM user_originArtist WHERE userIdx = ?'
const getGenreIdxQuery = 'SELECT * FROM user_genre WHERE userIdx = ?'

let songList = [];
let newList = [];
let ratedIdxList = [];
let originArtistSongList = []
let allGenreSongList = [];
var twelveHour = schedule.scheduleJob('0 5 12 1/1 * ? *', async () => { //매일 정오

    console.log("현재시간 : " + new Date() + " 평가 대기곡 스케줄러 실행");
    const getAllUserIdxResult = await pool.queryParam_None(getAllUserIdxQuery);
    for (var i = 0; i < getAllUserIdxResult.length; i++) {
        let userIdx = getAllUserIdxResult[i].userIdx;
        console.log(' user 넘버 : ' + userIdx);
        songList = [];
        newList = [];
        ratedIdxList = [];
        originArtistSongList = [];
        allGenreSongList = [];
        const getOriginArtistIdxResult = await pool.queryParam_Arr(getOriginArtistIdxQuery, [userIdx]);
        let ratedIdx = (await playlistModules.getPlayList(userIdx, 'rated'))._id;
        let rateReadyIdx = (await playlistModules.getPlayList(userIdx, 'rateReady'))._id;
        console.log('평가대기곡 플레이리스트 인덱스 : ' + rateReadyIdx);
        let ratedSongList = (await playlistModules.getSongList(ratedIdx));
        for (var a = 0; a < ratedSongList.length; a++) {
            ratedIdxList.push((ratedSongList[a]._id).toString())
        }
        console.log('평가 목록 : ' + ratedIdxList)
        for (var j = 0; j < getOriginArtistIdxResult.length; j++) {
            let originArtistIdx = getOriginArtistIdxResult[j].originArtistIdx;
            originArtistSongFind = await song.find(
                {
                    $and: [
                        { 'songStatus': { '$eq': 0 } },
                        { 'userIdx': { '$ne': userIdx } },
                        { '_id': { '$nin': ratedIdxList } },
                        { 'originArtistIdx': originArtistIdx }
                    ]
                }
            )
            if (originArtistSongFind == []) { //원곡 가수 기반 노래가 없을 때
                continue;
            }
            else {
                for (var b = 0; b < originArtistSongFind.length; b++) {
                    originArtistSongList.push(originArtistSongFind[b])
                }
            }
            //songStatus 가 0이면서, 선호하는 originArtist의 노래이면서, 자신이 업로드한 것이 아닌 노래면서, 평가하지도 않은 것
        }
        if (originArtistSongList.length < 10) { // 원곡 가수 기반이 10개 안 될때 : 장르 기반도 추가
            console.log('10개안댐')
            let originIdxArray = [];
            for (var c = 0; c < originArtistSongList.length; c++) {
                originIdxArray.push((originArtistSongList[c]._id).toString())
                songList.push(originArtistSongList[c])
            }
            let genreNameArray = [];
            let getGenreIdxResult = await pool.queryParam_Arr(getGenreIdxQuery, [userIdx]);
            for (var d = 0; d < getGenreIdxResult.length; d++) {
                genreNameArray.push(genreModule[getGenreIdxResult[d].genreIdx])
            }
            allGenreSongList = await song.find({
                $and: [
                    { 'songStatus': { '$eq': 0 } },
                    { 'userIdx': { '$ne': userIdx } },
                    { '_id': { '$nin': ratedIdxList } },
                    { '_id': { '$nin': originIdxArray } },
                    { 'genre': { '$in': genreNameArray } }
                ]
            }).limit(10 - songList.length)
            for (var e = 0; e < allGenreSongList.length; e++) {
                songList.push(allGenreSongList[e]);
            }
            console.log(songList);
            await playlist.updateOne({ _id: rateReadyIdx }, { $set: { songList: songList } })
        }
        else if (originArtistSongList.length > 10) { // 원곡 가수 기반이 10개 이상일 때, 랜덤으로 뽑음
            for (var f = 0; f < 10; f++) {
                newList[f] = originArtistSongList[shuffleRandom(originArtistSongList.length)[f]]
            }
            await playlist.update({ _id: rateReadyIdx }, { $set: { songList: newList } })
        }
        else {
            for (var g = 0; g < originArtistSongList.length; g++) {
                songList.push(originArtistSongList[g])
            }
            await playlist.updateOne({ _id: rateReadyIdx }, { $set: { songList: songList } })
        }
    }
    console.log("현재시간 : " + new Date() + " 평가 대기곡 스케줄러 실행 끝");
})

module.exports = router;