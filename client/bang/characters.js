const bangCharacters = {
  bartcassidy: { name: 'Bart Cassidy', health: 4, detail: 'Mỗi khi mất 1 máu và vẫn sống, rút ngay 1 lá từ chồng bài rút.' },
  blackjack: { name: 'Black Jack', health: 4, detail: 'Trong pha rút, công khai lá thứ hai. Nếu là cơ hoặc rô, rút thêm 1 lá úp.' },
  calamityjanet: { name: 'Calamity Janet', health: 4, detail: 'Có thể dùng BANG! thay cho Missed! và ngược lại. Khi đánh Missed! như BANG!, vẫn tính giới hạn BANG! mỗi lượt.' },
  elgringo: { name: 'El Gringo', health: 3, detail: 'Với mỗi máu mất do lá người khác đánh, nếu vẫn sống, lấy ngẫu nhiên 1 lá trên tay người đó. Dynamite không kích hoạt kỹ năng.' },
  jessejones: { name: 'Jesse Jones', health: 4, detail: 'Lá đầu trong pha rút có thể lấy ngẫu nhiên từ tay người khác. Lá thứ hai luôn lấy từ chồng bài rút.' },
  jourdonnais: { name: 'Jourdonnais', health: 4, detail: 'Khi bị lá BANG! nhắm vào, có thể lật một lá để né nếu ra cơ. Kỹ năng dùng riêng với Barrel.' },
  kitcarlson: { name: 'Kit Carlson', health: 4, detail: 'Trong pha rút, xem riêng 3 lá trên cùng. Chọn 2 lá vào tay, đặt lá còn lại úp lên đầu chồng bài.' },
  luckyduke: { name: 'Lucky Duke', health: 4, detail: 'Khi lật bài để kiểm tra Barrel, Jail hoặc Dynamite, hãy lật 2 lá, chọn 1 kết quả rồi bỏ cả hai.' },
  paulregret: { name: 'Paul Regret', health: 3, detail: 'Người khác nhìn bạn xa hơn 1. Trang bị Mustang cộng dồn thêm 1.' },
  pedroramirez: { name: 'Pedro Ramirez', health: 4, detail: 'Lá đầu trong pha rút có thể lấy từ đỉnh chồng bài bỏ. Lá thứ hai luôn lấy từ chồng bài rút.' },
  rosedoolan: { name: 'Rose Doolan', health: 4, detail: 'Bạn nhìn người khác gần hơn 1. Trang bị Scope trừ thêm 1, khoảng cách tối thiểu vẫn là 1.' },
  sidketchum: { name: 'Sid Ketchum', health: 4, detail: 'Bỏ đúng 2 lá trên tay để hồi 1 máu, kể cả ngoài lượt. Có thể lặp lại đến giới hạn máu.' },
  slab: { name: 'Slab the Killer', health: 4, detail: 'Đòn từ lá BANG! của bạn cần hai lần né. Mỗi lần lật thành công với Barrel chỉ tính một lần né.' },
  suzylafayette: { name: 'Suzy Lafayette', health: 4, detail: 'Khi hết bài trên tay, rút một lá sau khi hiệu ứng đang xử lý kết thúc.' },
  vulturesam: { name: 'Vulture Sam', health: 4, detail: 'Khi người khác bị loại, lấy tất cả lá trên tay và trước mặt họ, đưa vào tay mình.' },
  willythekid: { name: 'Willy the Kid', health: 4, detail: 'Được đánh bao nhiêu lá BANG! tùy ý trong lượt, vẫn phải đúng tầm súng.' },
};

function shuffleBang(items, random) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

function dealCharacterOffers(count, random = Math.random, options = {}) {
  const deck = shuffleBang(Object.keys(bangCharacters), random);
  if (Object.hasOwn(bangCharacters, options.character) && options.seat >= 0 && options.seat < count) {
    const source = deck.indexOf(options.character);
    const destination = options.seat * 2 + Math.floor(random() * 2);
    [deck[source], deck[destination]] = [deck[destination], deck[source]];
  }
  return Array.from({ length: count }, (_, index) => deck.slice(index * 2, index * 2 + 2));
}

const bangRoles = {
  sheriff: 'Cảnh sát trưởng', deputy: 'Phó cảnh sát', outlaw: 'Tội phạm', renegade: 'Kẻ phản bội',
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { characters: bangCharacters, shuffleBang, dealCharacterOffers, roles: bangRoles };
}
