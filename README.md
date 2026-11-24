# Studio Rebeca Cristina — Site

Site da nail designer Rebeca Cristina (Salvador, BA).

## Estrutura
```
index.html       → página do site
style.css        → cores, fontes e animações
script.js        → interações + agendamento (configurações no topo do arquivo)
img/             → fotos do site
```

## Como colocar as fotos
Salve as fotos na pasta `img/` com estes nomes (JPG, de preferência na vertical e com até ~300 KB):

| Arquivo | Onde aparece |
|---|---|
| `hero.jpg` | Foto grande do topo |
| `rebeca.jpg` | Foto da Rebeca (seção "Sobre") |
| `studio.jpg` | Foto redonda pequena (ambiente / detalhe) |
| `galeria-01.jpg` … `galeria-09.jpg` | Galeria de trabalhos |
| `compartilhar.jpg` | Imagem que aparece ao compartilhar o link no WhatsApp |

Enquanto uma foto não existir, aparece um degradê com o monograma "RC" no lugar.

## Como editar
- **Preços:** em `index.html`, troque "Consulte o valor" pelo preço (ex.: `R$ 35,00`).
- **Horários, dias fechados, serviços e WhatsApp:** no topo de `script.js` (objeto `CONFIG`).
