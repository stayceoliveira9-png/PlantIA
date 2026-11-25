<div align="center">
  <a href="https://plantapp-1--29bsmmwq.preview.emergentagent.com/">
    <img src="https://img.shields.io/badge/🌿_Aceder_ao_PlantIA-Abrir_Aplicativo-brightgreen?style=for-the-badge" alt="Aceder ao PlantIA">
  </a>
</div>
<div align="center">
  <h1>🌱 PlantIA</h1>
  <p><b>Inteligência Artificial aplicada à identificação, diagnóstico e cuidado inteligente de plantas.</b></p>
  <p>Aplicação moderna desenvolvida para auxiliar utilizadores a monitorizar, diagnosticar e cuidar da saúde das suas plantas através de tecnologia de ponta.</p>
</div>

---

## 🎯 Para que serve o PlantIA?

O **PlantIA** é um assistente inteligente de jardinagem e botânica pensado para qualquer pessoa que queira cuidar de plantas com precisão. O aplicativo serve para:
* **Identificar Espécies Instantaneamente:** O utilizador tira ou envia uma foto de uma planta e a inteligência artificial reconhece a espécie em segundos.
* **Diagnosticar Doenças e Pragas:** Deteta folhas doentes, manchas ou sinais de pragas, indicando soluções práticas de tratamento.
* **Orientação de Rega e Luz:** Fornece guias personalizados sobre a quantidade de água e luz solar que cada tipo de planta necessita.
* **Monitorização Contínua:** Permite acompanhar o histórico de saúde e o desenvolvimento de cada planta registada.

---

## 🔍 Como o Identificador de Plantas Funciona?

O núcleo do **PlantIA** baseia-se num sistema inteligente dividido entre o frontend e o backend:
1. **Captura da Imagem:** O utilizador tira uma fotografia da planta através da interface mobile/web (`frontend`).
2. **Envio via API:** A imagem é enviada de forma segura através de requisições HTTP para o servidor em FastAPI (`backend`) na rota de inteligência artificial.
3. **Processamento e Análise:** O backend processa os dados da imagem utilizando modelos de IA e algoritmos de visão computacional em ambiente assíncrono.
4. **Retorno de Diagnóstico:** O sistema devolve em tempo real o nome científico da planta, a probabilidade de acerto, possíveis doenças detetadas e as recomendações exatas de cuidado.

---

## 📂 Estrutura e Divisão das Partes do Projeto

O repositório está organizado de forma limpa e modular:

| Pasta / Módulo | Para que serve |
| :--- | :--- |
| **`backend/`** | Contém a API principal construída em **FastAPI** e **MongoDB** (Motor). É o cérebro do sistema, responsável pelas regras de negócio, rotas e ligação à inteligência artificial. |
| **`frontend/`** | Contém a aplicação multiplataforma desenvolvida com **Expo** e **Expo Router (React Native)**. É a interface visual com que o utilizador interage no telemóvel ou navegador. |
| **`memory/`** | Guarda ficheiros de suporte, como credenciais e dados de testes utilizados pelos subagentes de desenvolvimento. |
| **`tests/`** | Contém os testes automatizados (`pytest`) para garantir que o backend funciona sem erros. |

---

## 🚀 Como Executar o Projeto Localmente

Para testar o projeto no seu computador, utilize dois terminais em simultâneo:

```bash
# Terminal 1: Iniciar o Backend
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2: Iniciar o Frontend
cd frontend && yarn expo start --port 3000