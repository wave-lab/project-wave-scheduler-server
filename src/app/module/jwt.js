const jwt = require('jsonwebtoken');
const secretKey = require('../../config/secretKey').key;
//jwt 모듈화
module.exports = {

    //jwt 발급후 토큰 리턴
    sign: function (ID) {
        const options = {
            algorithm: "HS256",
            expiresIn: 60 * 60 * 24 * 30 //30 days
        };
        const payload = {
            userIdx: ID
        };
        let token = jwt.sign(payload, secretKey, options);
        return token;
    },

    //jwt 검증
    //검증이 성공할 경우 사용자 정보 리턴(ID값)
    //검증이 실패할 경우 -1 리턴
    //에러날 경우 -2 리턴
    verify: function (token) {
        let decoded;
        let err;
        try {
            decoded = jwt.verify(token, secretKey);
        }
        catch (err) {
            if (err.message == 'jwt must be provided') { // 비회원이라 토큰이 없을 때
                return -1;
            }
            else {
                return -2;
            }
        }
        return decoded.userIdx;
    }
};
