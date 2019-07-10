// 각종 라우팅을 연결하는 코드
const express = require('express');
const router = express.Router({mergeParams: true})

//schedule
router.use('/', require('./controller/scheduler/scheduler_routes'));

module.exports = router;