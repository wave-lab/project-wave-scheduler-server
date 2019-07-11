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
function removeDuplicateAry(arr) {
    let hashTable = {};
    return arr.filter((el) => {
        let key = JSON.stringify(el);
        let alreadyExist = !!hashTable[key];
        return (alreadyExist ? false : hashTable[key] = true);
    });
}
function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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
    console.log(getAllUserIdxResult);
    for (var i = 0; i < getAllUserIdxResult.length; i++) {
        let userIdx = getAllUserIdxResult[i].userIdx;
        console.log(' user 넘버 : ' + userIdx);
        const getOriginArtistIdxResult = await pool.queryParam_Arr(getOriginArtistIdxQuery, [userIdx]);
        let ratedIdx = (await playlistModules.getPlayList(userIdx, 'rated'))._id;
        let rateReadyIdx = (await playlistModules.getPlayList(userIdx, 'rateReady'))._id;
        let ratedSongList = (await playlistModules.getSongList(ratedIdx));
        for (var a = 0; a < ratedSongList.length; a++) {
            ratedIdxList.push(ratedSongList[a]._id)
        }
        for (var j = 0; j < getOriginArtistIdxResult.length; j++) {
            let originArtistIdx = getOriginArtistIdxResult[j].originArtistIdx;
            console.log(originArtistIdx);
            originArtistSongFind = await song.find({
                $and: [
                    { songStatus: 0 },
                    { originArtistIdx: originArtistIdx },
                    { userIdx: { $not: { $eq: userIdx } } },
                    { _id: { $nin: ratedIdxList } }
                ]
            })
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
            let originIdxArray = [];
            for (var c = 0; c < originArtistSongList.length; c++) {
                originIdxArray.push(originArtistSongList[c]._id)
                songList.push(originArtistSongList[c])
            }
            let genreNameArray = [];
            let getGenreIdxResult = await pool.queryParam_Arr(getGenreIdxQuery, [userIdx]);
            for (var d = 0; d < getGenreIdxResult.length; d++) {
                genreNameArray.push(genreModule[getGenreIdxResult[d].genreIdx])
            }
            allGenreSongList = await song.find({
                $and: [
                    { songStatus: 0 },
                    { userIdx: { $not: { $eq: userIdx } } },
                    { _id: { $nin: ratedIdx } },
                    { _id: { $nin: originIdxArray } },
                    { genre: { $in: genreNameArray } }
                ]
            }).limit(10 - songList.length)
            for (var e = 0; e < allGenreSongList.length; e++) {
                songList.push(allGenreSongList[e]);
            }
            //console.log(songList);
            console.log('10개안댐')
            await playlist.updateOne({ _id: rateReadyIdx }, { $set: { songList: songList } })
        }
        else if (originArtistSongList.length > 10) { // 원곡 가수 기반이 10개 이상일 때, 랜덤으로 뽑음
            for (var f = 0; f < 10; f++) {
                newList[f] = randomItem(originArtistSongList);
            }
            //console.log(newList);
            console.log('10개 이상')
            await playlist.updateOne({ _id: rateReadyIdx }, { $set: { songList: newList } })
        }
        else {
            for (var g = 0; g < originArtistSongList.length; g++) {
                songList.push(originArtistSongList[g])
            }
            //console.log(songList);
            console.log('10개')
            await playlist.updateOne({ _id: rateReadyIdx }, { $set: { songList: songList } })
        }
    }
    console.log("현재시간 : " + new Date() + " 평가 대기곡 스케줄러 실행 끝");
})

module.exports = router;