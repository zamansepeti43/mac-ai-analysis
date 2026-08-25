# Maç AI

Maç AI, futbol karşılaşmalarını istatistiksel verilerle analiz ederek gol olasılıkları üreten bir Next.js uygulamasıdır.

## İlk model

İlk nesil model son 5 maçın gol üretimi ve gol yeme ortalamalarını kullanır. Şu anki skorlar bir karar garantisi değildir; model daha sonra xG, sakatlıklar, kadrolar, iç/dış saha ayrımı ve geriye dönük backtest ile geliştirilecektir.

## Veri bağlantısı

Uygulama API-Football üzerinden günlük fikstürleri ve takımların son 5 maçını alabilir. Gerçek API anahtarı Vercel ortam değişkenlerinde `API_FOOTBALL_KEY` olarak tutulmalıdır.

API anahtarı tanımlı değilse uygulama güvenli demo verisiyle çalışır.

## Geliştirme sırası

1. Canlı fikstür ve takım geçmişi
2. Gol / 1.5 Üst / 2.5 Üst / KG modelleri
3. xG ve kadro verileri
4. Backtest ve doğruluk ölçümü
5. Model kalibrasyonu
6. Canlı maç ve bildirim altyapısı
