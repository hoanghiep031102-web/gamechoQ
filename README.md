# BANG! — Bàn chơi trực tuyến

Mục tiêu là chơi trọn một ván BANG! bản thẻ cơ bản với 4–7 người qua Internet, dùng giao diện HTML/CSS/JavaScript thuần và máy chủ Node.js, Express, Socket.IO. Luật tham chiếu là [BANG! của dV Games](https://www.dvgiochi.com/giochi/bang/download/Bang_rules_ENG.pdf).

## Chỗ chỉnh sửa trong dự án

| Bạn muốn chỉnh | Mở file |
| --- | --- |
| Tên, mô tả, số lượng và chất của lá bài | [card-catalog.js](client/bang/card-catalog.js) |
| Mô tả, máu gốc và cách chia hai nhân vật | [characters.js](client/bang/characters.js) |
| Hiệu ứng lá bài, tầm đánh, máu, phòng thủ và điều kiện thắng | [practice-rules.js](client/bang/practice-rules.js) |
| Kiểm tra Dynamite, Jail, lật Barrel và kỹ năng trong pha rút | [turn-flow.js](client/bang/turn-flow.js) |
| Thông tin một người chơi được xem, gồm bài trên tay, vai trò và lựa chọn riêng | [game-snapshot.js](client/bang/game-snapshot.js) |
| Cách máy đánh và phản hồi | [bot-turn.js](client/bang/bot-turn.js) |
| Bố cục ghế, nhân vật và trang bị hiện trên bàn | [table-seats.js](client/bang/table-seats.js) và [table.css](client/bang/table.css) |
| Tay bài, thao tác và nút trên bàn | [practice.js](client/bang/practice.js), [index.html](client/bang/index.html) và [table.css](client/bang/table.css) |
| Hiệu ứng, thông báo và âm thanh | [board-effects.js](client/bang/board-effects.js), [game-notices.js](client/bang/game-notices.js) và [game-audio.js](client/game-audio.js) |
| Tạo phòng, vào phòng, chọn nhân vật online và kết nối lại | [server.js](server/server.js) và [code.js](client/code.js) |

Khi bấm đánh bài, giao diện trong `practice.js` gửi một yêu cầu. Chế độ online gửi qua `online-table.js` đến `server.js`. Cả online và chơi với máy đều đưa yêu cầu vào [game-actions.js](client/bang/game-actions.js), rồi bộ luật kiểm tra nước đi. Khi chỉnh luật, sửa ở bộ luật dùng chung để hai chế độ có cùng hành vi.

Sau khi sửa, thử một ván qua **Chơi với máy** và một phòng online. Nếu sửa pha rút, thử thêm Kit Carlson và Lucky Duke. Nếu sửa dữ liệu gửi về màn hình, dùng hai ghế để kiểm tra tay bài và lựa chọn riêng.

Một tiến trình máy chủ đủ cho nhóm bạn. MVP là tạo và tham gia phòng riêng bằng mã, chơi hết một ván bản cơ bản trên cùng URL HTTPS, kết nối lại vào đúng ghế và xem kết quả. Các điểm cần kiểm thử gồm kỹ năng thay đổi luật chung, lựa chọn phản hồi ngoài lượt, tầm đánh sau khi loại người chơi, thao tác lặp và quyền xem dữ liệu sau khi kết nối lại. Trận lưu trong RAM sẽ mất nếu máy chủ khởi động lại.

## Lộ trình

1. **Prototype** — bàn Western, bố cục 4–7 ghế, tay bài, chọn lá và mục tiêu mẫu.
2. **Gameplay offline** — chia vai, nhân vật, bộ bài cơ bản, rút/đánh/bỏ, tầm đánh, kỹ năng, loại người và điều kiện thắng. Dùng ghế giả lập để kiểm tra chuỗi hành động.
3. **Multiplayer** — phòng riêng, mã mời, trạng thái riêng theo người chơi, kiểm tra hành động phía máy chủ và kết nối lại.
4. **Hoàn thiện** — hình minh họa đồng bộ, chat phòng, hiệu ứng, âm thanh và kiểm thử đa thiết bị.
5. **Triển khai** — chạy Express/Socket.IO trên hosting hỗ trợ WebSocket, chia sẻ URL và mã phòng, kiểm tra từ các mạng khác nhau.

## Chạy prototype

Để mở sảnh, chạy `npm ci` trong thư mục `server` nếu chưa cài thư viện. Từ thư mục dự án, chạy `node server/server.js`. Mở `http://localhost:3000`, nhập tên và chọn **Tạo phòng mới**. Bạn bè dùng cùng địa chỉ máy chủ, nhập tên và mã, rồi chọn **Vào phòng**. Để thử trên cùng máy, mở bốn tab độc lập từ thanh địa chỉ. Để thử trong cùng mạng, dùng địa chỉ IP nội bộ của máy chạy server kèm cổng 3000.

Khi có 4–7 người, chủ phòng chọn **Bắt đầu ván**. Mỗi người nhận riêng hai nhân vật lấy từ cùng một bộ đã xáo và chọn một. Khi mọi người chọn xong, bàn chơi mở và nhân vật đã chọn hiện công khai. Máy chủ dùng bộ luật ở `client/bang/practice-rules.js`, xác thực lượt, lá bài và kỹ năng, rồi gửi từng người tay bài và vai trò của mình. Tải lại đúng tab trong vòng hai phút để giữ lượt chọn hoặc quay lại ghế. Nếu ai đó rời hẳn trong lúc chọn hay đang chơi, phòng trở về sảnh. Chủ phòng có thể chơi ván mới sau khi có kết quả. Phòng và ván lưu trong RAM.

Chọn **Chơi với máy** từ sảnh để tập với 3–6 bot. Bạn vẫn chọn một trong hai nhân vật, các bot tự chọn từ hai lá riêng của mỗi ghế. Vai trò được chia ngẫu nhiên mỗi ván. Cả hai chế độ dùng 80 lá chơi và 16 nhân vật của bộ cơ bản. Bấm ảnh nhân vật tại ghế để đọc kỹ năng. Khi muốn thử một kỹ năng, chọn tên tại menu **Nhân vật** rồi bấm **Đặt lại** để đưa nhân vật đó vào một trong hai lựa chọn của bạn.

Vân gỗ bàn đấu dùng [Dark Wooden Planks của Amal Kumar trên Poly Haven](https://polyhaven.com/a/dark_wooden_planks), giấy phép CC0.

Mở `client/bang/index.html` trong trình duyệt. Đổi số ghế từ 4 đến 7, chọn **BANG!** rồi chọn một người khác để xem nhật ký. Thử chọn **Missed!**, **Beer** và **Barrel** để xem mô tả. Nút **Kết thúc lượt** chuyển lượt mẫu, còn **Đặt lại** khôi phục bố cục và nhật ký. Prototype dùng dữ liệu mẫu, hình minh họa tạm và thao tác mô phỏng. Duyệt giao diện trước khi chuyển sang gameplay.

## Chơi từ các mạng khác nhau

1. Trên GitHub, tạo repo **Private**. Đưa `client/`, `server/`, `render.yaml`, `README.md` và `.gitignore` lên gốc repo. Nếu tải lên qua trình duyệt, dùng **Add file → Upload files**, kéo các thư mục và tệp đã giải nén vào rồi chọn **Commit changes**. [Hướng dẫn tải tệp lên GitHub](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
2. Trong Render, chọn **New → Blueprint**, kết nối GitHub và chọn repo vừa tạo. Chọn nhánh `main`, để đường dẫn Blueprint là `render.yaml`. Kiểm tra danh sách hiện một **Web Service** gói **Free**, rồi chọn **Deploy Blueprint**. [Hướng dẫn Render Blueprint](https://render.com/docs/infrastructure-as-code)
3. Khi dịch vụ báo **Live**, mở URL HTTPS có đuôi `onrender.com` Render cấp. Nhập tên và chọn **Tạo phòng mới**. Gửi link và mã phòng cho bạn bè để họ nhập tên và chọn **Vào phòng**.
4. Thử với một thiết bị dùng 4G/5G. Kiểm tra hai người thấy nhau trong sảnh, rồi thử bắt đầu ván và chọn nhân vật khi có đủ 4–7 người.

GitHub giữ mã nguồn riêng tư, còn URL Render mở được từ Internet. Sau một thời gian không có lưu lượng, lần mở đầu tiên của gói Free có thể mất khoảng một phút. [Giới hạn gói Free](https://render.com/docs/free)

Render chạy `npm run build:public --prefix server` rồi phục vụ riêng thư mục `server/public-online/`. Bộ luật, bot và mã máy chủ không được gửi tới trình duyệt. Người chơi vẫn có thể xem các tệp giao diện mà trình duyệt cần tải để chạy. Bấm **Chơi với máy online** tại sảnh để đấu với 3–6 bot chạy trên server. Chọn tổng số người từ 4 đến 7 tại sảnh, chọn nhân vật rồi chơi ngay. Tên có thể để trống để dùng tên Bạn. Ván với máy là phòng riêng, chỉ người tạo được tham gia.

Ván lưu trong RAM, vì vậy việc triển khai lại hoặc máy chủ khởi động lại sẽ kết thúc các phòng hiện tại. Trước khi phát hành link công khai với ảnh hoặc thương hiệu gốc, xác nhận phạm vi sử dụng với dV Games. [Hướng dẫn dự án fan](https://www.dvgiochi.com/giochi/bang/download/BANG%21%20fan%20contribution%20ENG.pdf)
