<template>
  <LegalLayout titulo="Política de privacidade" :atualizado="ATUALIZADO">
    <h2>Quem cuida dos seus dados</h2>
    <p>
      O controlador é Icaro Melo, criador independente do Kairos, pessoa física. Por ser agente de tratamento de pequeno
      porte, não há encarregado (DPO) nomeado. Para qualquer assunto de privacidade, escreva para
      <a :href="`mailto:${CONTATO}`">{{ CONTATO }}</a> ou use a página de <RouterLink to="/suporte">suporte</RouterLink>.
    </p>

    <h2>O resumo</h2>
    <ul>
      <li>O Kairos não tem anúncios, não vende dados e não usa ferramentas de análise, rastreamento ou publicidade de terceiros.</li>
      <li>Voz, vídeo e tela compartilhada passam pelo servidor em tempo real e não são gravados.</li>
      <li>Você pode apagar a conta a qualquer momento, sozinho, em <RouterLink to="/excluir-conta">Excluir conta</RouterLink>.</li>
    </ul>

    <h2>O que tratamos e por quê</h2>
    <ul>
      <li><b>Conta:</b> e-mail, senha (guardada só como hash) e o seu @nome. Se você entra com Google ou GitHub, guardamos o identificador da conta nesse serviço e o e-mail verificado que ele informa. Base: execução do contrato (os termos de uso).</li>
      <li><b>Personagem:</b> a aparência que você monta no editor.</li>
      <li><b>Servidores e convívio:</b> servidores de que você participa e seu papel neles, amizades, convites, mensagens diretas, tarefas e notas que você cria e músicas que você adiciona à jukebox.</li>
      <li><b>Presença:</b> posição no mapa, sala e estado do microfone, usados ao vivo para mostrar você aos outros. Não guardamos histórico de onde você andou.</li>
      <li><b>Voz, vídeo e tela:</b> transmitidos ao vivo para quem está perto de você no mapa. Não há gravação.</li>
      <li><b>Feedback e suporte:</b> o que você escreve nos formulários, para responder e corrigir problemas.</li>
      <li><b>Data do aceite dos termos</b>, para registrar que você concordou com eles.</li>
    </ul>

    <h2>O que fica no seu aparelho</h2>
    <p>
      O navegador guarda a sua sessão, a última posição no mapa e preferências como minimapa, filtro de pixel e os aparelhos
      de áudio e vídeo escolhidos. Não usamos cookies de rastreamento.
    </p>

    <h2>Quem mais recebe dados</h2>
    <ul>
      <li><b>Oracle Cloud</b>, onde ficam o servidor e o banco de dados. Os servidores podem estar fora do Brasil.</li>
      <li><b>Google e GitHub</b>, só se você escolher entrar com eles: eles recebem o pedido de login e nos devolvem o identificador e o e-mail.</li>
      <li><b>YouTube</b>, quando alguém toca música na jukebox a partir de um link do YouTube.</li>
      <li>As outras pessoas do mesmo servidor veem seu @nome, seu personagem, sua presença e o que você publica nele.</li>
    </ul>

    <h2>Por quanto tempo</h2>
    <p>
      Os dados ficam enquanto a conta existir. Ao excluir a conta, apagamos na hora conta, personagem, conversas, amizades,
      convites, participação em servidores e feedbacks. Tarefas e notas que você criou dentro de um servidor com outras
      pessoas continuam lá, porque fazem parte do espaço de trabalho do grupo, mas sem ligação com a sua conta.
      Cópias de segurança do banco são apagadas em até 90 dias.
    </p>

    <h2>Seus direitos</h2>
    <p>
      Pela LGPD você pode pedir confirmação, acesso, correção, portabilidade e exclusão dos seus dados, além de
      informações sobre com quem eles são compartilhados. Escreva para <a :href="`mailto:${CONTATO}`">{{ CONTATO }}</a>;
      respondemos em até 15 dias. Você também pode reclamar à ANPD.
    </p>

    <h2>Crianças e adolescentes</h2>
    <p>O Kairos é para pessoas com {{ IDADE_MINIMA }} anos ou mais. Se soubermos de uma conta de alguém mais novo, ela será apagada.</p>

    <h2>Segurança</h2>
    <p>
      O acesso é sempre por HTTPS, as senhas são guardadas só como hash e o banco não fica exposto na internet. Nenhum
      sistema é infalível; se houver um incidente que afete você, avisaremos.
    </p>

    <h2>Mudanças nesta política</h2>
    <p>Quando a política mudar de forma relevante, a data no topo muda e avisamos dentro do Kairos.</p>
  </LegalLayout>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import LegalLayout from './LegalLayout.vue'
import { ATUALIZADO, CONTATO, IDADE_MINIMA } from './legal'
</script>
